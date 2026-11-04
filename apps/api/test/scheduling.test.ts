import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import {
  createScheduleSchema,
  occurrenceWindow,
  occursOn,
  wallTime,
} from "@beside/domain/schedules";
import { createSeed } from "@beside/domain/seed";
import { execute } from "@beside/domain/model";
import { settleExpiredMilestones } from "@beside/domain/expiry";
import { parseDatabase } from "@beside/domain/validation";
import { createApp } from "../src/application.ts";
import { DatabaseService } from "../src/db/database.service.ts";
import type { ApiState, Session } from "@beside/domain/api";

const configuration = () =>
  createScheduleSchema.parse({
    name: "Wednesday workout",
    quantity: 1,
    timeZone: "America/Toronto",
    startDate: "2030-01-02",
    startTime: "09:00",
    endTime: "10:00",
    recurrence: { frequency: "weekly", weekdays: [3] },
  });

it("keeps weekly windows at local wall time across DST, resolves overlaps and skips gaps", () => {
  const s = configuration();
  assert.deepEqual(occurrenceWindow(s, "2030-01-02"), {
    startAt: "2030-01-02T14:00:00.000Z",
    endAt: "2030-01-02T15:00:00.000Z",
  });
  assert.deepEqual(occurrenceWindow(s, "2030-07-03"), {
    startAt: "2030-07-03T13:00:00.000Z",
    endAt: "2030-07-03T14:00:00.000Z",
  });
  assert.equal(wallTime("2026-03-08", "02:30", s.timeZone), null);
  assert.equal(
    wallTime("2026-11-01", "01:30", s.timeZone),
    "2026-11-01T05:30:00.000Z",
  );
  assert.equal(
    wallTime("2030-01-02", "00:00", "Asia/Kathmandu"),
    "2030-01-01T18:15:00.000Z",
  );
});

it("supports weekday intervals, monthly dates and ordinal weekdays, and validates schedule inputs", () => {
  const s = configuration();
  assert.equal(occursOn(s, "2030-01-02"), true);
  assert.equal(occursOn(s, "2030-01-03"), false);
  s.recurrence = { frequency: "weekly", interval: 2, weekdays: [3] };
  assert.equal(occursOn(s, "2030-01-09"), false);
  assert.equal(occursOn(s, "2030-01-16"), true);
  s.recurrence = { frequency: "monthly", interval: 1, dayOfMonth: 31 };
  assert.equal(occursOn(s, "2030-01-31"), true);
  assert.equal(occursOn(s, "2030-02-28"), false);
  s.recurrence = {
    frequency: "monthly-weekday",
    interval: 1,
    weekday: 3,
    ordinal: 1,
  };
  assert.equal(occursOn(s, "2030-02-06"), true);
  assert.equal(occursOn(s, "2030-02-13"), false);
  s.recurrence.ordinal = -1;
  assert.equal(occursOn(s, "2030-02-27"), true);
  s.recurrence = { frequency: "daily", interval: 2 };
  assert.equal(occursOn(s, "2030-01-04"), true);
  s.until = "2030-01-04";
  assert.equal(occursOn(s, "2030-01-04"), true);
  assert.equal(occursOn(s, "2030-01-06"), false);
  const overnight = createScheduleSchema.parse({
    ...configuration(),
    startTime: "23:00",
    endTime: "01:00",
    endDayOffset: 1,
  });
  assert.deepEqual(occurrenceWindow(overnight, "2030-01-02"), {
    startAt: "2030-01-03T04:00:00.000Z",
    endAt: "2030-01-03T06:00:00.000Z",
  });
  for (const patch of [
    { timeZone: "not-a-zone" },
    { endTime: "08:00" },
    { until: "2029-01-01" },
    { count: 3, until: "2030-02-01" },
    { startDate: "2030-02-30" },
  ])
    assert.equal(
      createScheduleSchema.safeParse({ ...configuration(), ...patch }).success,
      false,
    );
});

it("settles missing outcomes once after the inclusive end; late failures are valid, late successes are rejected", () => {
  const now = "2026-10-21T18:00:00.000Z";
  const seed = createSeed();
  const activity = seed.activities.find((a) => a.connectionId === "circle")!;
  const planned = execute(
    seed,
    {
      type: "createMilestone",
      actorId: "mosaab",
      activityId: activity.id,
      parentId: null,
      name: "Wednesday",
      quantity: 1,
      policy: "paced",
      startAt: now,
      endAt: "2026-10-21T19:00:00.000Z",
      itemId: null,
    },
    now,
  );
  const log = {
    authorUserId: "mosaab",
    milestoneId: planned.entityId,
    isSuccess: true,
    title: "Done",
    durationMinutes: 0,
    occurredAt: now,
    origin: "manual" as const,
  };
  const succeeded = execute(
    planned.db,
    { type: "recordLog", actorId: "mosaab", input: log },
    now,
  ).db;
  assert.equal(
    settleExpiredMilestones(succeeded, "2026-10-21T19:00:00.000Z")
      .failuresRecorded,
    0,
  );
  const settled = settleExpiredMilestones(
    succeeded,
    "2026-10-21T19:00:00.001Z",
  );
  assert.equal(settled.failuresRecorded, 2);
  assert.ok(parseDatabase(settled.db));
  assert.equal(
    settleExpiredMilestones(settled.db, "2026-10-22T18:00:00.000Z")
      .failuresRecorded,
    0,
  );
  assert.throws(
    () =>
      execute(
        planned.db,
        { type: "recordLog", actorId: "mosaab", input: log },
        "2026-10-21T19:00:00.001Z",
      ),
    /closed/,
  );
  assert.ok(
    parseDatabase(
      execute(
        planned.db,
        {
          type: "recordLog",
          actorId: "mosaab",
          input: { ...log, isSuccess: false },
        },
        "2026-10-21T19:00:00.001Z",
      ).db,
    ),
  );
  assert.throws(
    () =>
      execute(
        planned.db,
        {
          type: "recordLog",
          actorId: "mosaab",
          input: { ...log, isSuccess: false },
        },
        "2026-10-21T17:59:59.999Z",
      ),
    /not started/,
  );
});

describe(
  "scheduled milestone API",
  { skip: !process.env.TEST_DATABASE_URL },
  () => {
    let app: Awaited<ReturnType<typeof createApp>>;
    const previousSecret = process.env.CRON_SECRET;
    const secret = "test-only-cron-token";
    before(async () => {
      process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
      process.env.CRON_SECRET = secret;
      app = await createApp(false);
      await app.init();
    });
    after(async () => {
      await app.close();
      if (previousSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previousSecret;
    });

    it("protects the cron endpoint, including when its secret is unset", async () => {
      await request(app.getHttpServer())
        .get("/api/cron/milestones")
        .expect(401);
      await request(app.getHttpServer())
        .get("/api/cron/milestones")
        .set("Authorization", "Bearer incorrect")
        .expect(401);
      delete process.env.CRON_SECRET;
      await request(app.getHttpServer())
        .get("/api/cron/milestones")
        .set("Authorization", "Bearer undefined")
        .expect(401);
      process.env.CRON_SECRET = secret;
    });

    it("runs the four-person workflow, retries concurrently, catches up schedules, and cancels future occurrences", async (t) => {
      t.mock.timers.enable({
        apis: ["Date"],
        now: new Date("2030-01-02T13:00:00Z"),
      });
      const server = app.getHttpServer();
      const nonce = crypto.randomUUID();
      const post = async (
        session: Session,
        path: string,
        body: object,
        status = 201,
      ) =>
        (
          await request(server)
            .post(`/api/v1/${path}`)
            .set("Authorization", `Bearer ${session.token}`)
            .send(body)
            .expect(status)
        ).body;
      const register = async (
        index: number,
        inviteCode?: string,
      ): Promise<Session> =>
        (
          await request(server)
            .post("/api/v1/auth/register")
            .send({
              name: `Schedule ${index}`,
              email: `schedule.${index}.${nonce}@example.test`,
              password: "test-only-password-12345",
              inviteCode,
            })
            .expect(201)
        ).body;
      const owner = await register(0);
      const base = (
        await request(server)
          .get("/api/v1/homebases")
          .set("Authorization", `Bearer ${owner.token}`)
          .expect(200)
      ).body[0];
      const people = [owner];
      for (let i = 1; i < 4; i++)
        people.push(await register(i, base.inviteCode));
      const outsider = await register(4);
      await request(server)
        .get("/api/cron/milestones")
        .set("Authorization", `Bearer ${owner.token}`)
        .expect(401);
      const activity = await post(owner, "activities", {
        name: "Weekly together",
        templateId: "workout",
        connectionId: base.id,
        target: 20,
      });
      const schedule = await post(
        owner,
        `activities/${activity.entityId}/schedules`,
        { ...configuration(), itemId: "sunflower", count: 8 },
      );
      assert.equal(schedule.generatedCount, 6);
      await post(
        outsider,
        `activities/${activity.entityId}/schedules`,
        configuration(),
        404,
      );
      await request(server)
        .get(`/api/v1/activities/${activity.entityId}/schedules`)
        .set("Authorization", `Bearer ${outsider.token}`)
        .expect(404);
      await request(server)
        .delete(`/api/v1/schedules/${schedule.id}`)
        .set("Authorization", `Bearer ${outsider.token}`)
        .expect(404);
      const read = async (): Promise<ApiState> =>
        (
          await request(server)
            .get("/api/v1/state")
            .set("Authorization", `Bearer ${owner.token}`)
            .expect(200)
        ).body;
      const initial = await read();
      const milestone = initial.milestones.find(
        (m) =>
          m.activityId === activity.entityId &&
          m.startAt === "2030-01-02T14:00:00.000Z",
      )!;
      assert.ok(milestone);
      const log = {
        milestoneId: milestone.id,
        isSuccess: true,
        title: "Wednesday done",
        durationMinutes: 30,
        occurredAt: "2030-01-02T14:00:00Z",
        origin: "manual",
        externalKey: nonce,
      };
      await post(owner, "logs", log, 400); // Before opening.
      t.mock.timers.setTime(Date.parse(milestone.startAt!));
      await post(owner, "logs", log, 200);
      t.mock.timers.setTime(Date.parse(milestone.endAt!));
      const cron = () =>
        request(server)
          .get("/api/cron/milestones")
          .set("Authorization", `Bearer ${secret}`)
          .expect(200);
      assert.equal((await cron()).body.failuresRecorded, 0);
      t.mock.timers.setTime(Date.parse(milestone.endAt!) + 1);
      const results = await Promise.all([cron(), cron()]);
      assert.equal(
        results.reduce((sum, result) => sum + result.body.failuresRecorded, 0),
        3,
      );
      await post(
        people[1]!,
        "logs",
        { ...log, externalKey: `${nonce}-late` },
        400,
      );
      const snapshot = await read();
      const outcomes = snapshot.logs.filter(
        (l) => l.milestoneId === milestone.id,
      );
      assert.equal(outcomes.filter((l) => l.isSuccess).length, 1);
      assert.equal(
        outcomes.filter((l) => !l.isSuccess && l.origin === "automation")
          .length,
        3,
      );
      assert.equal(
        snapshot.rewards.find((r) => r.id === milestone.rewardId)!.obtainedAt,
        null,
      );
      assert.equal(
        snapshot.contributions.filter((c) =>
          outcomes.some((l) => l.id === c.logId),
        ).length,
        1,
      );
      assert.equal((await post(owner, "logs", log, 200)).duplicate, true);
      // A late member should not get a failure for an occurrence already closed.
      await post(
        outsider,
        "homebases/join",
        { inviteCode: base.inviteCode },
        200,
      );
      assert.equal((await cron()).body.failuresRecorded, 0);
      // A read settles expiry between daily cron invocations too.
      const next = snapshot.milestones.find(
        (m) =>
          m.activityId === activity.entityId &&
          m.startAt === "2030-01-09T14:00:00.000Z",
      )!;
      t.mock.timers.setTime(Date.parse(next.endAt!) + 1);
      assert.equal(
        (await read()).logs.filter(
          (l) => l.milestoneId === next.id && !l.isSuccess,
        ).length,
        5,
      );
      // Advance enough to require more occurrences; count is capped at eight.
      t.mock.timers.setTime(Date.parse("2030-02-01T13:00:00Z"));
      assert.equal((await cron()).body.milestonesCreated, 2);
      assert.equal((await cron()).body.milestonesCreated, 0);
      const listed = (
        await request(server)
          .get(`/api/v1/activities/${activity.entityId}/schedules`)
          .set("Authorization", `Bearer ${owner.token}`)
          .expect(200)
      ).body;
      assert.equal(listed[0].generatedCount, 8);
      assert.equal(listed[0].enabled, false);
      // Deleting a schedule preserves logged/past milestones, removes future ones.
      await request(server)
        .delete(`/api/v1/schedules/${schedule.id}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .expect(200);
      const remaining = (await read()).milestones.filter(
        (m) => m.activityId === activity.entityId && m.kind === "achievement",
      );
      assert.ok(remaining.some((m) => m.id === milestone.id));
      assert.ok(remaining.every((m) => m.startAt! <= new Date().toISOString()));
      // Domain validation accepts the persisted automatic failure trail.
      const { loadDatabase } = await import("../src/db/storage.ts");
      await app.get(DatabaseService).transaction(false, async (client) => {
        assert.ok(parseDatabase(await loadDatabase(client)));
      });
      // Activity deletion also cascades its recurring schedules.
      await post(owner, `activities/${activity.entityId}/schedules`, {
        ...configuration(),
        startDate: "2030-02-06",
      });
      await request(server)
        .delete(`/api/v1/activities/${activity.entityId}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .expect(200);
      const rows = await app
        .get(DatabaseService)
        .getPool()
        .query("SELECT 1 FROM milestone_schedule WHERE activity_id = $1", [
          activity.entityId,
        ]);
      assert.equal(rows.rowCount, 0);
    });
  },
);

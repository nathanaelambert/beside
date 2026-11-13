import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createSeed } from "@beside/domain/seed";
import { execute } from "@beside/domain/model";
import {
  gardenHistory,
  gardenPlots,
  homebaseRewards,
  rewardStatus,
} from "@beside/domain/precursors";
import { addDays, localDateAt } from "@beside/domain/schedules";
import { parseDatabase } from "@beside/domain/validation";
import type { Database } from "@beside/domain/types";
import type { ApiState, HomebaseRewards, Session } from "@beside/domain/api";
import { createApp } from "../src/application.ts";
import { DatabaseService } from "../src/db/database.service.ts";

const now = "2026-11-13T18:00:00.000Z";
const later = (minutes: number) =>
  new Date(Date.parse(now) + minutes * 60000).toISOString();

// A fresh one-person base keeps the seed's own rewards out of the counts.
function garden() {
  let db = createSeed();
  const base = execute(
    db,
    { type: "createHomebase", actorId: "mosaab", name: "Precursor garden" },
    now,
  );
  db = base.db;
  const activity = execute(
    db,
    {
      type: "createActivity",
      actorId: "mosaab",
      templateId: "custom-project",
      name: "Build club",
      description: "",
      connectionId: base.entityId,
      subjectIds: [],
      target: 10,
    },
    now,
  );
  return {
    db: activity.db,
    homebaseId: base.entityId,
    activityId: activity.entityId,
  };
}

function plan(
  db: Database,
  activityId: string,
  itemId: string,
  at = now,
  endAt: string | null = null,
) {
  return execute(
    db,
    {
      type: "createMilestone",
      actorId: "mosaab",
      activityId,
      parentId: null,
      name: `Earn ${itemId}`,
      quantity: 1,
      policy: endAt ? "deadline" : "open",
      startAt: null,
      endAt,
      itemId,
    },
    at,
  );
}

function complete(db: Database, milestoneId: string, at = now) {
  return execute(
    db,
    {
      type: "recordLog",
      actorId: "mosaab",
      input: {
        authorUserId: "mosaab",
        milestoneId,
        isSuccess: true,
        title: "Done",
        durationMinutes: 0,
        origin: "manual",
      },
    },
    at,
  ).db;
}

const objectsIn = (db: Database, homebaseId: string) =>
  db.gardenObjects.filter((o) => o.homebaseId === homebaseId);

describe("precursor rewards in the domain", () => {
  it("locks a Christmas tree until an oak is planned, then decorates that oak in place", () => {
    let { db, homebaseId, activityId } = garden();
    assert.throws(
      () => plan(db, activityId, "christmas-tree"),
      /Christmas tree needs a Meadow oak in your garden first/,
    );
    assert.equal(
      rewardStatus(db, homebaseId, "christmas-tree", now).kind,
      "locked",
    );

    const oak = plan(db, activityId, "oak-tree");
    db = oak.db;
    // A planned oak is a promise: the tree can be planned, and waits for it.
    assert.equal(
      rewardStatus(db, homebaseId, "christmas-tree", now).kind,
      "queued",
    );
    const tree = plan(db, activityId, "christmas-tree", later(1));
    db = tree.db;
    // One oak supports one Christmas tree.
    assert.throws(
      () => plan(db, activityId, "christmas-tree", later(2)),
      /needs a Meadow oak/,
    );

    db = complete(db, oak.entityId, later(3));
    const [placed] = objectsIn(db, homebaseId);
    assert.deepEqual(
      { itemId: placed!.itemId, x: placed!.x, y: placed!.y },
      { itemId: "oak-tree", ...gardenPlots[0] },
    );
    assert.ok(db.events.some((e) => e.type === "garden.placed"));

    db = complete(db, tree.entityId, later(4));
    const [decorated] = objectsIn(db, homebaseId);
    assert.equal(objectsIn(db, homebaseId).length, 1);
    assert.equal(decorated!.id, placed!.id);
    assert.equal(decorated!.itemId, "christmas-tree");
    assert.deepEqual([decorated!.x, decorated!.y], [placed!.x, placed!.y]);
    assert.ok(
      db.events.some(
        (e) =>
          e.type === "garden.upgraded" &&
          e.message.includes("Meadow oak became Christmas tree"),
      ),
    );
    assert.deepEqual(
      gardenHistory(db, decorated!).map((r) => r.itemId),
      ["oak-tree", "christmas-tree"],
    );
    parseDatabase(structuredClone(db));
  });

  it("builds a cottage stage by stage on one plot, and lands an early stage once its precursor exists", () => {
    let { db, homebaseId, activityId } = garden();
    const stages = [
      "cottage-foundation",
      "cottage-walls",
      "cottage-roof",
      "cottage",
    ];
    assert.throws(
      () => plan(db, activityId, "cottage-roof"),
      /needs a Cottage walls/,
    );
    const ids: string[] = [];
    // Each planned stage unlocks planning the next one.
    for (const [index, itemId] of stages.entries()) {
      assert.equal(
        rewardStatus(db, homebaseId, itemId, later(index)).kind,
        index ? "queued" : "place",
      );
      const planned = plan(db, activityId, itemId, later(index));
      db = planned.db;
      ids.push(planned.entityId);
    }
    const catalog = homebaseRewards(db, homebaseId, later(5));
    assert.deepEqual(
      catalog.items
        .filter((item) => stages.includes(item.itemId))
        .map((item) => [item.itemId, item.status.kind, item.planned]),
      [
        // Each planned stage already claims the one below it, so another of
        // any upper stage would need another foundation first.
        ["cottage-foundation", "place", 1],
        ["cottage-walls", "locked", 1],
        ["cottage-roof", "locked", 1],
        ["cottage", "locked", 1],
      ],
    );

    // The walls are earned before the foundation: they wait, then land with it.
    db = complete(db, ids[1]!, later(10));
    assert.equal(objectsIn(db, homebaseId).length, 0);
    assert.ok(db.events.some((e) => e.type === "garden.waiting"));
    assert.equal(
      homebaseRewards(db, homebaseId, later(10)).items.find(
        (i) => i.itemId === "cottage-walls",
      )!.waiting,
      1,
    );

    db = complete(db, ids[0]!, later(11));
    let [house] = objectsIn(db, homebaseId);
    assert.equal(house!.itemId, "cottage-walls");
    const plot = [house!.x, house!.y];
    for (const [index, id] of ids.slice(2).entries()) {
      db = complete(db, id, later(12 + index));
      [house] = objectsIn(db, homebaseId);
      assert.equal(house!.itemId, stages[index + 2]);
      assert.deepEqual([house!.x, house!.y], plot);
    }
    assert.equal(objectsIn(db, homebaseId).length, 1);
    assert.equal(
      homebaseRewards(db, homebaseId, later(20)).builds[0]!.reached,
      4,
    );
    assert.deepEqual(
      gardenHistory(db, house!).map((r) => r.itemId),
      stages,
    );
    parseDatabase(structuredClone(db));
  });

  it("releases a claim when an upgrade's window closes unearned, and keeps the garden when its milestone is deleted", () => {
    let { db, homebaseId, activityId } = garden();
    const oak = plan(db, activityId, "oak-tree");
    db = complete(oak.db, oak.entityId);
    const missed = plan(db, activityId, "christmas-tree", now, later(30));
    db = missed.db;
    assert.equal(
      rewardStatus(db, homebaseId, "christmas-tree", later(10)).kind,
      "locked",
    );
    assert.equal(
      rewardStatus(db, homebaseId, "christmas-tree", later(31)).kind,
      "ready",
    );

    db = execute(
      db,
      { type: "deleteMilestone", actorId: "mosaab", milestoneId: oak.entityId },
      later(40),
    ).db;
    assert.equal(objectsIn(db, homebaseId)[0]!.itemId, "oak-tree");
    parseDatabase(structuredClone(db));
  });

  it("does not let a milestone switch to a locked reward", () => {
    let { db, activityId } = garden();
    const planned = plan(db, activityId, "sunflower");
    db = planned.db;
    assert.throws(
      () =>
        execute(
          db,
          {
            type: "updateMilestone",
            actorId: "mosaab",
            milestoneId: planned.entityId,
            changes: { itemId: "cottage-walls" },
          },
          now,
        ),
      /Cottage walls needs a Cottage foundation/,
    );
  });
});

describe(
  "precursor rewards over PostgreSQL",
  { skip: !process.env.TEST_DATABASE_URL },
  () => {
    let app: Awaited<ReturnType<typeof createApp>>;
    let ada: Session, ben: Session;
    let homebaseId: string;
    let activityId: string;
    const nonce = crypto.randomUUID();
    const password = "test-only-password-12345";
    const auth = (session: Session) => ({
      Authorization: `Bearer ${session.token}`,
    });
    const http = () => request(app.getHttpServer());
    const state = async (session: Session): Promise<ApiState> =>
      (await http().get("/api/v1/state").set(auth(session)).expect(200)).body;
    const rewards = async (session: Session): Promise<HomebaseRewards> =>
      (
        await http()
          .get(`/api/v1/homebases/${homebaseId}/rewards`)
          .set(auth(session))
          .expect(200)
      ).body;
    const plan = (itemId: string, status = 201) =>
      http()
        .post("/api/v1/milestones")
        .set(auth(ada))
        .send({
          activityId,
          parentId: null,
          name: `Earn ${itemId}`,
          quantity: 1,
          policy: "open",
          startAt: null,
          endAt: null,
          itemId,
        })
        .expect(status);
    const attend = (session: Session, milestoneId: string) =>
      http()
        .post("/api/v1/logs")
        .set(auth(session))
        .send({
          milestoneId,
          isSuccess: true,
          title: "I was there",
          durationMinutes: 0,
          origin: "manual",
          externalKey: `attendance:${milestoneId}`,
        })
        .expect(200);

    // Sign-ups share one per-IP budget across test files; reset it on this
    // disposable test database so suites do not starve each other.
    const resetSignupBudget = () =>
      app.get(DatabaseService).getPool().query("DELETE FROM auth_rate_limit");
    before(async () => {
      process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
      app = await createApp(false);
      await app.init();
      await resetSignupBudget();
      ada = (
        await http()
          .post("/api/v1/auth/register")
          .send({ name: "Ada", email: `ada.${nonce}@example.test`, password })
          .expect(201)
      ).body;
      homebaseId = (await state(ada)).connections[0]!.id;
      const { body: bases } = await http()
        .get("/api/v1/homebases")
        .set(auth(ada))
        .expect(200);
      ben = (
        await http()
          .post("/api/v1/auth/register")
          .send({
            name: "Ben",
            email: `ben.${nonce}@example.test`,
            password,
            inviteCode: bases[0].inviteCode,
          })
          .expect(201)
      ).body;
      activityId = (
        await http()
          .post("/api/v1/activities")
          .set(auth(ada))
          .send({
            templateId: "custom-project",
            name: "Garden club",
            connectionId: homebaseId,
            target: 5,
          })
          .expect(201)
      ).body.entityId;
    });
    after(async () => {
      // Leave no open windows behind for other suites' clock-mocked cron runs.
      await http()
        .delete(`/api/v1/homebases/${homebaseId}`)
        .set(auth(ada))
        .expect(200);
      await resetSignupBudget();
      await app.close();
    });

    it("serves the precursor catalog and the garden in the contract", async () => {
      const { body } = await http().get("/openapi.json").expect(200);
      assert.ok(body.paths["/api/v1/homebases/{homebaseId}/rewards"].get);
      assert.ok(body.paths["/api/v1/garden"].get);
      assert.ok(body.components.schemas.State.properties.gardenObjects);
      const catalog = await rewards(ada);
      const status = (itemId: string) =>
        catalog.items.find((item) => item.itemId === itemId)!.status;
      assert.equal(status("oak-tree").kind, "place");
      assert.deepEqual(status("christmas-tree"), {
        kind: "locked",
        precursorId: "oak-tree",
        chain: ["oak-tree"],
      });
      assert.deepEqual(status("cottage"), {
        kind: "locked",
        precursorId: "cottage-roof",
        chain: ["cottage-roof", "cottage-walls", "cottage-foundation"],
      });
      const stranger: Session = (
        await http()
          .post("/api/v1/auth/register")
          .send({
            name: "Stranger",
            email: `stranger.${nonce}@example.test`,
            password,
          })
          .expect(201)
      ).body;
      await http()
        .get(`/api/v1/homebases/${homebaseId}/rewards`)
        .set(auth(stranger))
        .expect(404);
    });

    it("earns an oak together, then upgrades it into a Christmas tree for both members", async () => {
      const locked = await plan("christmas-tree", 400);
      assert.match(locked.body.message, /needs a Meadow oak in your garden/);
      const oak = (await plan("oak-tree")).body.entityId;
      await attend(ada, oak);
      assert.equal((await state(ada)).gardenObjects.length, 0); // Ben is still required.
      await attend(ben, oak);
      const [planted] = (await state(ben)).gardenObjects;
      assert.equal(planted!.itemId, "oak-tree");
      const ready = (await rewards(ben)).items.find(
        (i) => i.itemId === "christmas-tree",
      )!;
      assert.deepEqual(ready.status, {
        kind: "ready",
        precursorId: "oak-tree",
        targetObjectId: planted!.id,
      });

      const tree = (await plan("christmas-tree")).body.entityId;
      await attend(ada, tree);
      await attend(ben, tree);
      // Replaying a check-in neither duplicates credit nor re-applies the upgrade.
      const replay = await attend(ben, tree);
      assert.equal(replay.body.duplicate, true);
      const { body: garden } = await http()
        .get("/api/v1/garden")
        .set(auth(ada))
        .expect(200);
      assert.deepEqual(
        garden.map((o: { id: string; itemId: string }) => [o.id, o.itemId]),
        [[planted!.id, "christmas-tree"]],
      );
      const snapshot = await state(ada);
      assert.ok(
        snapshot.events.some(
          (e) =>
            e.type === "garden.upgraded" &&
            e.message ===
              "Meadow oak became Christmas tree in Ada's home base's garden.",
        ),
      );
      assert.equal(
        snapshot.rewards.filter((r) => r.gardenObjectId === planted!.id).length,
        2,
      );
    });

    it("keeps upgrades out of recurring schedules and checks locks when scheduling", async () => {
      // Start tomorrow so occurrences fall inside the 35-day generation horizon.
      const startDate = addDays(
        localDateAt(new Date().toISOString(), "America/Toronto"),
        1,
      );
      const schedule = (itemId: string, count: number | null) => ({
        name: "Build night",
        quantity: 1,
        itemId,
        timeZone: "America/Toronto",
        startDate,
        startTime: "18:00",
        endTime: "20:00",
        recurrence: {
          frequency: "weekly",
          weekdays: [new Date(`${startDate}T12:00:00Z`).getUTCDay()],
        },
        count,
      });
      const recurring = await http()
        .post(`/api/v1/activities/${activityId}/schedules`)
        .set(auth(ada))
        .send(schedule("cottage-foundation", null));
      assert.equal(recurring.status, 201, recurring.body.message);
      assert.ok(recurring.body.id);
      const repeated = await http()
        .post(`/api/v1/activities/${activityId}/schedules`)
        .set(auth(ada))
        .send(schedule("cottage-walls", 3))
        .expect(400);
      assert.match(repeated.body.message, /one-off milestone/);
      await http()
        .post(`/api/v1/activities/${activityId}/schedules`)
        .set(auth(ada))
        .send(schedule("cottage-walls", 1))
        .expect(201);
      // Two queued foundations exist now, but the cottage still needs a roof.
      const locked = await http()
        .post(`/api/v1/activities/${activityId}/schedules`)
        .set(auth(ada))
        .send(schedule("cottage", 1))
        .expect(400);
      assert.match(locked.body.message, /Cosy cottage needs a Cottage roof/);
    });
  },
);

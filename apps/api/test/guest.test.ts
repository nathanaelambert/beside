import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import type {
  ApiHomebase,
  ApiState,
  GuestSession,
  Session,
} from "@beside/domain/api";
import { avatarAppearanceSchema } from "@beside/domain/avatar";
import { createApp } from "../src/application.ts";
import { tokenHash } from "../src/auth.ts";
import { DatabaseService } from "../src/db/database.service.ts";

it("documents a guest join with exactly name and invite code", async () => {
  const app = await createApp(false);
  try {
    await app.init();
    const { body } = await request(app.getHttpServer())
      .get("/openapi.json")
      .expect(200);
    assert.deepEqual(body.components.schemas.JoinAsGuest.required, [
      "name",
      "inviteCode",
    ]);
    assert.equal(
      body.components.schemas.JoinAsGuest.additionalProperties,
      false,
    );
    const route = body.paths["/api/v1/auth/guest"].post;
    assert.ok(route.responses[404]);
    assert.ok(route.responses[429]);
    assert.equal(route.security, undefined);
  } finally {
    await app.close();
  }
});

describe(
  "Guest invitation and session integration",
  { skip: !process.env.TEST_DATABASE_URL },
  () => {
    let app: Awaited<ReturnType<typeof createApp>>;
    let host: Session, stranger: Session;
    let base: ApiHomebase, other: ApiHomebase;
    let existingActivityId: string, milestoneId: string;
    const password = "local-testing-password";
    const auth = (session: Session | GuestSession) => ({
      Authorization: `Bearer ${session.token}`,
    });
    const http = () => request(app.getHttpServer());
    const getPool = () => app.get(DatabaseService).getPool();
    const state = async (session: Session | GuestSession): Promise<ApiState> =>
      (await http().get("/api/v1/state").set(auth(session)).expect(200)).body;
    const homebases = async (
      session: Session | GuestSession,
    ): Promise<ApiHomebase[]> =>
      (await http().get("/api/v1/homebases").set(auth(session)).expect(200))
        .body;
    const createActivity = async (user: Session, connectionId: string) =>
      (
        await http()
          .post("/api/v1/activities")
          .set(auth(user))
          .send({
            name: "Reading club",
            templateId: "read-book",
            connectionId,
            target: 1,
          })
          .expect(201)
      ).body.entityId as string;
    const join = async (name = "Juniper"): Promise<GuestSession> =>
      (
        await http()
          .post("/api/v1/auth/guest")
          .send({ name: ` ${name} `, inviteCode: ` ${base.inviteCode} ` })
          .expect(201)
      ).body;

    before(async () => {
      process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
      app = await createApp(false);
      await app.init();
      const register = async (name: string): Promise<Session> =>
        (
          await http()
            .post("/api/v1/auth/register")
            .send({
              name,
              email: `${crypto.randomUUID()}@example.test`,
              password,
            })
            .expect(201)
        ).body;
      host = await register("Rowan");
      stranger = await register("Ari");
      [base] = (await homebases(host)) as [ApiHomebase];
      [other] = (await homebases(stranger)) as [ApiHomebase];
      existingActivityId = await createActivity(host, base.id);
      await createActivity(stranger, other.id);
      const { body: subject } = await http()
        .post("/api/v1/subjects")
        .set(auth(host))
        .send({
          templateId: "book",
          title: "Personal notes on a book",
        })
        .expect(201);
      await http()
        .post(`/api/v1/activities/${existingActivityId}/subjects`)
        .set(auth(host))
        .send({ subjectId: subject.entityId })
        .expect(201);
      const { body: milestone } = await http()
        .post("/api/v1/milestones")
        .set(auth(host))
        .send({
          activityId: existingActivityId,
          parentId: null,
          name: "Award an oak",
          quantity: 1,
          policy: "open",
          startAt: null,
          endAt: null,
          itemId: "oak-tree",
        })
        .expect(201);
      milestoneId = milestone.entityId;
      await http()
        .post("/api/v1/logs")
        .set(auth(host))
        .send({
          milestoneId,
          isSuccess: true,
          title: "Private title for the shared log",
          durationMinutes: 15,
          origin: "manual",
          externalKey: crypto.randomUUID(),
        })
        .expect(200);
    });

    after(async () => {
      await app.close();
    });

    it("rejects missing or invalid invitations without creating users or sessions", async () => {
      const pool = getPool();
      const counts = async () =>
        (
          await pool.query(
            `SELECT (SELECT count(*) FROM app_user) AS users,
        (SELECT count(*) FROM homebase_member) AS memberships,
        (SELECT count(*) FROM auth_session) AS sessions`,
          )
        ).rows[0];
      const before = await counts();
      for (const input of [
        { name: "Juniper" },
        { name: " ", inviteCode: base.inviteCode },
        {
          name: "Juniper",
          inviteCode: base.inviteCode,
          email: host.user.email,
        },
        { name: "Juniper", inviteCode: base.inviteCode, password },
      ])
        await http().post("/api/v1/auth/guest").send(input).expect(400);
      await http()
        .post("/api/v1/auth/guest")
        .send({ name: "Juniper", inviteCode: "x".repeat(32) })
        .expect(404);
      await http().get("/api/v1/state").expect(401);
      assert.deepEqual(await counts(), before);
    });

    it("joins one island, saves an avatar without credentials and stays out of activity/reward rosters", async () => {
      const guest = await join();
      assert.deepEqual(guest.user, {
        id: guest.user.id,
        name: "Juniper",
        color: "blue",
        email: null,
        isGuest: true,
      });
      assert.match(guest.token, /^[A-Za-z0-9_-]{43}$/);
      const ttlDays = (Date.parse(guest.expiresAt) - Date.now()) / 86_400_000;
      assert.ok(ttlDays > 29.9 && ttlDays <= 30);
      const pool = getPool();
      const { rows } = await pool.query(
        "SELECT token_hash FROM auth_session WHERE user_id = $1",
        [guest.user.id],
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].token_hash, tokenHash(guest.token));
      assert.equal(
        (
          await pool.query("SELECT 1 FROM auth_credential WHERE user_id = $1", [
            guest.user.id,
          ])
        ).rowCount,
        0,
      );
      await http()
        .get("/api/v1/auth/me")
        .set(auth(guest))
        .expect(200, guest.user);
      const visible = await state(guest);
      assert.deepEqual(
        visible.connections.map((home) => home.id),
        [base.id],
      );
      assert.deepEqual(
        visible.activities.map((activity) => activity.id),
        [existingActivityId],
      );
      assert.ok(visible.rewards.some((reward) => reward.obtainedAt !== null));
      assert.deepEqual(
        (await homebases(guest)).map((home) => [home.id, home.inviteCode]),
        [[base.id, null]],
      );
      for (const key of [
        "subjects",
        "activitySubjects",
        "logs",
        "events",
        "deliveries",
        "logShares",
        "participations",
        "contributions",
      ] as const)
        assert.deepEqual(visible[key], [], key);
      assert.ok(
        (await state(host)).subjects.some(
          (subject) => subject.title === "Personal notes on a book",
        ),
      );
      const saved = visible.memberships.find(
        (member) => member.userId === guest.user.id,
      )?.avatarAppearance;
      const avatar = avatarAppearanceSchema.parse(saved);
      const next = {
        ...avatar,
        outfit:
          avatar.outfit === "moss-jacket" ? "clay-sweater" : "moss-jacket",
      };
      await http()
        .put(`/api/v1/homebases/${base.id}/avatar`)
        .set(auth(guest))
        .send(next)
        .expect(200, next);
      await http()
        .get("/api/v1/auth/me")
        .set(auth(guest))
        .expect(200, guest.user);
      const newActivityId = await createActivity(host, base.id);
      const memberState = await state(host);
      assert.equal(
        memberState.memberships.find((member) => member.userId === host.user.id)
          ?.avatarAppearance,
        undefined,
      );
      assert.deepEqual(
        memberState.memberships.find(
          (member) => member.userId === guest.user.id,
        )?.avatarAppearance,
        next,
      );
      assert.equal(
        memberState.participations.some(
          (person) => person.userId === guest.user.id,
        ),
        false,
      );
      assert.equal(
        memberState.logs.some((log) => log.authorUserId === guest.user.id),
        false,
      );
      assert.equal(
        memberState.rewards.some((reward) =>
          reward.requiredUserIds.includes(guest.user.id),
        ),
        false,
      );
      assert.ok(
        memberState.participations.some(
          (person) =>
            person.activityId === newActivityId &&
            person.userId === host.user.id,
        ),
      );
      assert.equal(
        (
          await pool.query(
            "SELECT 1 FROM event_delivery WHERE recipient_user_id = $1",
            [guest.user.id],
          )
        ).rowCount,
        0,
      );
      assert.equal((await homebases(host))[0]!.inviteCode, base.inviteCode);
      assert.equal(
        (await homebases(stranger))[0]!.memberIds.includes(guest.user.id),
        false,
      );
    });

    it("denies cross-island avatar edits and denies other reads and writes by default", async () => {
      const guest = await join();
      const avatar = (await state(guest)).memberships.find(
        (member) => member.userId === guest.user.id,
      )?.avatarAppearance;
      assert.ok(avatar);
      await http()
        .get(`/api/v1/homebases/${base.id}/garden`)
        .set(auth(guest))
        .expect(200);
      await http()
        .get(`/api/v1/homebases/${base.id}/expansion`)
        .set(auth(guest))
        .expect(200, { additions: [] });
      await http()
        .get(`/api/v1/homebases/${other.id}/garden`)
        .set(auth(guest))
        .expect(404);
      await http()
        .get(`/api/v1/homebases/${other.id}/expansion`)
        .set(auth(guest))
        .expect(404);
      await http()
        .put(`/api/v1/homebases/${other.id}/avatar`)
        .set(auth(guest))
        .send(avatar)
        .expect(404);
      await http()
        .put(`/api/v1/homebases/${base.id}/avatar`)
        .set(auth(guest))
        .send({ ...avatar, userId: host.user.id })
        .expect(400);
      for (const path of [
        "events",
        "logs",
        "subjects",
        "activities",
        `homebases/${base.id}/reward-agreements`,
        `activities/${existingActivityId}/schedules`,
      ])
        await http().get(`/api/v1/${path}`).set(auth(guest)).expect(403);
      for (const [method, path] of [
        ["post", "homebases"],
        ["post", "homebases/join"],
        ["patch", `homebases/${base.id}`],
        ["delete", `homebases/${base.id}`],
        ["post", "activities"],
        ["delete", `activities/${existingActivityId}`],
        ["post", `activities/${existingActivityId}/schedules`],
        ["delete", `milestones/${milestoneId}`],
        ["post", "logs"],
        ["post", `homebases/${base.id}/garden/starter-oak`],
        ["put", `homebases/${base.id}/expansion`],
      ] as const)
        await http()
          [method](`/api/v1/${path}`)
          .set(auth(guest))
          .send({})
          .expect(403);
    });

    it("drops expired or signed-out visitors from the active roster without deleting their avatars", async () => {
      const expired = await join("Fern");
      const revoked = await join("Lake");
      const ids = [expired.user.id, revoked.user.id];
      const [activeRoster] = await homebases(host);
      assert.ok(ids.every((id) => activeRoster!.memberIds.includes(id)));
      const pool = getPool();
      await pool.query(
        "UPDATE auth_session SET expires_at = now() - interval '1 second' WHERE user_id = $1",
        [expired.user.id],
      );
      await http().post("/api/v1/auth/logout").set(auth(revoked)).expect(204);
      for (const session of [expired, revoked]) {
        await http().get("/api/v1/auth/me").set(auth(session)).expect(401);
        await http().get("/api/v1/state").set(auth(session)).expect(401);
      }
      assert.equal(
        (await homebases(host))[0]!.memberIds.some((id) => ids.includes(id)),
        false,
      );
      const snapshot = await state(host);
      assert.equal(
        snapshot.memberships.some((member) => ids.includes(member.userId)),
        false,
      );
      assert.equal(
        snapshot.users.some((user) => ids.includes(user.id)),
        false,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT 1 FROM homebase_member WHERE user_id = ANY($1::text[]) AND avatar_appearance IS NOT NULL",
            [ids],
          )
        ).rowCount,
        2,
      );
    });

    it("keeps password registration and login available to normal members", async () => {
      const email = `${crypto.randomUUID()}@example.test`;
      const { body } = await http()
        .post("/api/v1/auth/register")
        .send({ name: "Juniper", email, password, inviteCode: base.inviteCode })
        .expect(201);
      const account = body as Session;
      assert.equal(account.user.email, email);
      assert.equal("isGuest" in account.user, false);
      assert.ok(
        (await state(account)).participations.some(
          (p) =>
            p.activityId === existingActivityId && p.userId === account.user.id,
        ),
      );
      const login = await http()
        .post("/api/v1/auth/login")
        .send({ email: email.toUpperCase(), password })
        .expect(200);
      assert.deepEqual(login.body.user, account.user);
      await http()
        .post("/api/v1/auth/register")
        .send({ name: "Duplicate", email, password })
        .expect(409);
    });

    it("rate limits repeated guest attempts independently of password sign-ins", async () => {
      app.getHttpAdapter().getInstance().set("trust proxy", 1);
      try {
        const ip = `2001:db8::${crypto.randomUUID().slice(0, 4)}`;
        for (let n = 0; n < 30; n++)
          await http()
            .post("/api/v1/auth/guest")
            .set("X-Forwarded-For", ip)
            .send({})
            .expect(400);
        await http()
          .post("/api/v1/auth/guest")
          .set("X-Forwarded-For", ip)
          .send({ name: "Juniper", inviteCode: base.inviteCode })
          .expect(429);
        await http()
          .post("/api/v1/auth/login")
          .set("X-Forwarded-For", ip)
          .send({ email: host.user.email, password })
          .expect(200);
      } finally {
        app.getHttpAdapter().getInstance().set("trust proxy", false);
      }
    });
  },
);

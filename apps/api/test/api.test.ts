import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import SwaggerParser from "@apidevtools/swagger-parser";
import { createApp } from "../src/application.ts";
import { DatabaseService } from "../src/db/database.service.ts";
import { loadDatabase } from "../src/db/storage.ts";
import { parseDatabase } from "@beside/domain/validation";
import { schemas } from "../src/openapi.ts";
import type { Session, ApiState } from "@beside/domain/api";

describe("public API contract without a database", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  before(async () => {
    app = await createApp(false);
    await app.init();
  });
  after(async () => {
    await app.close();
  });
  it("serves liveness, the explorer, and a concrete OpenAPI contract", async () => {
    const server = app.getHttpServer();
    await request(server).get("/health").expect(200, { status: "ok" });
    await request(server)
      .get("/docs")
      .expect(200)
      .expect("Content-Type", /html/);
    await request(server)
      .get("/docs/swagger-ui.css")
      .expect(200)
      .expect("Content-Type", /css/);
    const { body } = await request(server).get("/openapi.json").expect(200);
    await SwaggerParser.validate(structuredClone(body));
    assert.match(body.openapi, /^3\./);
    assert.ok(body.paths["/api/v1/logs"].post);
    assert.ok(body.paths["/api/v1/auth/register"].post);
    assert.equal(body.components.schemas.CreateLog.additionalProperties, false);
    assert.equal(
      body.components.schemas.CreateLog.properties.authorUserId,
      undefined,
    );
    assert.equal(
      body.components.schemas.CreateLog.properties.actorId,
      undefined,
    );
    assert.ok(
      body.components.schemas.State.properties.milestones.items.properties.id,
    );
    assert.equal(
      body.components.schemas.PublicUser.properties.email,
      undefined,
    );
    assert.equal(
      body.components.schemas.Register.properties.password.minLength,
      12,
    );
    assert.ok(body.paths["/api/v1/state"].get.security);
    await request(server).get("/openapi.yaml").expect(200);
  });
  it("requires a session and validates credentials before touching the database", async () => {
    await request(app.getHttpServer()).get("/api/v1/state").expect(401);
    const { body } = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ name: "Test", email: "invalid", password: "short" })
      .expect(400);
    assert.ok(
      body.issues.some((issue: { path: string }) => issue.path === "email"),
    );
  });
  it("allows configured browser origins and never caches account responses", async () => {
    const server = app.getHttpServer();
    await request(server)
      .options("/api/v1/auth/login")
      .set("Origin", "http://localhost:3002")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type")
      .expect(204)
      .expect("Access-Control-Allow-Origin", "http://localhost:3002");
    await request(server)
      .get("/api/v1/state")
      .set("Origin", "http://localhost:3002")
      .expect(401)
      .expect("Cache-Control", "no-store");
    const response = await request(server)
      .options("/api/v1/auth/login")
      .set("Origin", "https://unrelated.example.test")
      .set("Access-Control-Request-Method", "POST")
      .expect(204);
    assert.equal(response.headers["access-control-allow-origin"], undefined);
  });
});

describe(
  "PostgreSQL API integration",
  { skip: !process.env.TEST_DATABASE_URL },
  () => {
    let app: Awaited<ReturnType<typeof createApp>>;
    let alice: Session, bob: Session, stranger: Session;
    const nonce = crypto.randomUUID();
    const password = "test-only-password-12345";
    const auth = (session: Session) => ({
      Authorization: `Bearer ${session.token}`,
    });
    const state = async (session: Session): Promise<ApiState> =>
      (
        await request(app.getHttpServer())
          .get("/api/v1/state")
          .set(auth(session))
          .expect(200)
      ).body;
    const create = async (
      session: Session,
      path: string,
      body: object,
      status = 201,
    ) =>
      (
        await request(app.getHttpServer())
          .post(`/api/v1/${path}`)
          .set(auth(session))
          .send(body)
          .expect(status)
      ).body;
    const milestoneBody = (
      activityId: string,
      itemId: string | null = null,
    ) => ({
      activityId,
      parentId: null,
      name: "First chapter",
      quantity: 1,
      policy: "open",
      startAt: null,
      endAt: null,
      itemId,
    });
    const logBody = (milestoneId: string, externalKey: string) => ({
      milestoneId,
      isSuccess: true,
      title: "Finished first chapter",
      durationMinutes: 20,
      occurredAt: new Date(Date.now() - 1000).toISOString(),
      origin: "manual",
      externalKey,
    });
    before(async () => {
      process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
      app = await createApp(false);
      await app.init();
      const register = async (name: string): Promise<Session> =>
        (
          await request(app.getHttpServer())
            .post("/api/v1/auth/register")
            .send({ name, email: `${name}.${nonce}@example.test`, password })
            .expect(201)
        ).body;
      alice = await register("Alice");
      bob = await register("Bob");
      stranger = await register("Stranger");
    });
    after(async () => {
      await app.close();
    });
    it("creates real accounts, hashes credentials, and provisions personal home bases", async () => {
      const snapshot = await state(alice);
      assert.equal(snapshot.users.length, 1);
      assert.equal(snapshot.users[0]!.id, alice.user.id);
      assert.equal("email" in snapshot.users[0]!, false);
      assert.equal(snapshot.connections[0]!.personalOwnerId, alice.user.id);
      assert.ok(
        snapshot.activityTemplates.length > 0 &&
          snapshot.rewardItems.length > 0,
      );
      await request(app.getHttpServer()).get("/health/ready").expect(200);
      const pool = app.get(DatabaseService).getPool();
      const { rows } = await pool.query(
        "SELECT password_hash FROM auth_credential WHERE user_id = $1",
        [alice.user.id],
      );
      assert.notEqual(rows[0].password_hash, password);
      assert.equal(
        (
          await pool.query("SELECT 1 FROM auth_session WHERE token_hash = $1", [
            alice.token,
          ])
        ).rowCount,
        0,
      );
      const { body } = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: alice.user.email.toUpperCase(), password })
        .expect(200);
      assert.equal(body.user.id, alice.user.id);
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: alice.user.email, password: "wrong-password-12345" })
        .expect(401);
    });
    it("keeps private subjects, activity history, and emails away from unrelated users", async () => {
      const subject = await create(alice, "subjects", {
        templateId: "book",
        title: "A private book",
        metadata: { Author: "Test Author" },
      });
      const activity = await create(alice, "activities", {
        templateId: "read-book",
        name: "Private reading",
        target: 3,
        subjectIds: [subject.entityId],
      });
      const snapshot = await state(alice);
      assert.ok(snapshot.subjects.some((row) => row.id === subject.entityId));
      assert.ok(snapshot.logs.some((log) => log.origin === "automation"));
      assert.equal(
        (await state(stranger)).activities.some(
          (row) => row.id === activity.entityId,
        ),
        false,
      );
      await create(
        stranger,
        "milestones",
        milestoneBody(activity.entityId),
        400,
      );
      await create(
        stranger,
        `activities/${activity.entityId}/subjects`,
        { subjectId: subject.entityId },
        400,
      );
      await create(
        alice,
        "activities",
        {
          templateId: "read-book",
          name: "Forged author",
          target: 3,
          actorId: bob.user.id,
        },
        400,
      );
    });
    it("serializes concurrent cooperative completions and idempotent retries", async () => {
      const base = await create(alice, "homebases", {
        name: "Reading friends",
      });
      await create(bob, "homebases/join", { inviteCode: base.inviteCode }, 200);
      const activity = await create(alice, "activities", {
        templateId: "read-book",
        name: "Shared reading",
        target: 3,
        connectionId: base.id,
      });
      const milestone = await create(
        alice,
        "milestones",
        milestoneBody(activity.entityId, "oak-tree"),
      );
      const a = logBody(milestone.entityId, `alice-${nonce}`),
        b = logBody(milestone.entityId, `bob-${nonce}`);
      const results = await Promise.all([
        create(alice, "logs", a, 200),
        create(alice, "logs", a, 200),
        create(bob, "logs", b, 200),
        create(bob, "logs", b, 200),
      ]);
      assert.equal(results.filter((result) => result.duplicate).length, 2);
      assert.equal(results[0].entityId, results[1].entityId);
      const snapshot = await state(alice);
      const reward = snapshot.rewards.find(
        (row) =>
          row.id ===
          snapshot.milestones.find((row) => row.id === milestone.entityId)
            ?.rewardId,
      )!;
      assert.ok(reward.obtainedAt);
      assert.deepEqual(
        new Set(reward.requiredUserIds),
        new Set([alice.user.id, bob.user.id]),
      );
      assert.equal(
        snapshot.events.filter(
          (event) =>
            event.type === "reward.obtained" && event.entityId === reward.id,
        ).length,
        1,
      );
      assert.equal(
        snapshot.logs.filter((log) => log.milestoneId === milestone.entityId)
          .length,
        2,
      );
      assert.equal(
        (await state(stranger)).rewards.some((row) => row.id === reward.id),
        false,
      );
      await create(
        alice,
        "logs",
        { ...a, externalKey: `another-${nonce}` },
        400,
      );
      const replay = await create(alice, "logs", a, 200);
      assert.equal(replay.duplicate, true);
      // A late member joins existing activities; the earned reward's saved roster stays unchanged.
      await create(
        stranger,
        "homebases/join",
        { inviteCode: base.inviteCode },
        200,
      );
      const late = await state(stranger);
      assert.ok(
        late.participations.some(
          (p) =>
            p.activityId === activity.entityId &&
            p.userId === stranger.user.id &&
            p.status === "active",
        ),
      );
      assert.equal(
        late.rewards
          .find((row) => row.id === reward.id)!
          .requiredUserIds.includes(stranger.user.id),
        false,
      );
    });
    it("uses server submission time and rejects forged authors", async () => {
      const activity = await create(alice, "activities", {
        templateId: "reading-habit",
        name: "Scheduled reading",
        target: 1,
      });
      const milestone = await create(alice, "milestones", {
        ...milestoneBody(activity.entityId),
        policy: "deadline",
        endAt: "2020-01-01T00:00:00.000Z",
      });
      await create(
        alice,
        "logs",
        {
          ...logBody(milestone.entityId, `expired-${nonce}`),
          occurredAt: "2019-01-01T00:00:00.000Z",
        },
        400,
      );
      await create(
        alice,
        "logs",
        {
          ...logBody(milestone.entityId, `forged-${nonce}`),
          authorUserId: bob.user.id,
        },
        400,
      );
      const open = await create(
        alice,
        "milestones",
        milestoneBody(activity.entityId),
      );
      await create(
        alice,
        "logs",
        {
          ...logBody(open.entityId, `future-${nonce}`),
          occurredAt: "2099-01-01T00:00:00.000Z",
        },
        400,
      );
    });
    it("round-trips a valid domain model through relational persistence", async () => {
      const snapshot = await app
        .get(DatabaseService)
        .transaction(false, (client) => loadDatabase(client));
      assert.doesNotThrow(() => parseDatabase(snapshot));
      schemas.State.parse(await state(alice));
      const db = app.get(DatabaseService);
      await assert.rejects(
        db.transaction(true, async (client) => {
          const log = snapshot.logs.find((row) => row.isSuccess)!;
          await client.query(
            "INSERT INTO activity_log SELECT $1, author_user_id, milestone_id, is_success, subject_id, category, title, quantity, unit, duration_minutes, occurred_at, origin, NULL, created_at FROM activity_log WHERE id = $2",
            [`copy_${nonce}`, log.id],
          );
        }),
        (error: unknown) => (error as { code: string }).code === "23505",
      );
    });
    it("revokes a bearer session on logout", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set(auth(bob))
        .expect(200);
      await request(app.getHttpServer())
        .post("/api/v1/auth/logout")
        .set(auth(bob))
        .expect(204);
      await request(app.getHttpServer())
        .get("/api/v1/state")
        .set(auth(bob))
        .expect(401);
    });
  },
);

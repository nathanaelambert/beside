import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { execute } from "@beside/domain/model";
import { acornBalance } from "@beside/domain/acorns";
import { parseDatabase } from "@beside/domain/validation";
import type { Command, Database } from "@beside/domain/types";
import type { ApiState, Session } from "@beside/domain/api";
import { createApp } from "../src/application.ts";
import { DatabaseService } from "../src/db/database.service.ts";
import { emptyDatabase, loadDatabase } from "../src/db/storage.ts";

// Experiment: rewards bought with a shared acorn pool.

describe("acorn rules in the shared command engine", () => {
  const people = ["ana", "ben", "cy"];
  let db: Database;
  let clock = Date.parse("2026-11-13T10:00:00.000Z");
  const tick = () => new Date((clock += 1000)).toISOString();
  const run = (command: Command) => {
    const result = execute(db, command, tick());
    db = result.db;
    return result.entityId;
  };
  const checkIn = (actorId: string, milestoneId: string) =>
    run({
      type: "recordLog",
      actorId,
      input: {
        authorUserId: actorId,
        milestoneId,
        isSuccess: true,
        title: "Done",
        durationMinutes: 10,
        origin: "manual",
      },
    });
  const milestone = (actorId: string, activityId: string, name: string) =>
    run({
      type: "createMilestone",
      actorId,
      activityId,
      parentId: null,
      name,
      quantity: 1,
      policy: "open",
      startAt: null,
      endAt: null,
      itemId: null,
    });
  let base: string;
  let activity: string;

  before(() => {
    db = emptyDatabase();
    for (const id of people)
      db.users.push({
        id,
        name: id,
        email: `${id}@example.test`,
        color: "blue",
      });
    base = run({ type: "createHomebase", actorId: "ana", name: "Meadow" });
    db.memberships.push({ id: "m_ben", connectionId: base, userId: "ben" });
    activity = run({
      type: "createActivity",
      actorId: "ana",
      templateId: "read-book",
      name: "Read together",
      description: "",
      connectionId: base,
      subjectIds: [],
      target: 5,
    });
  });

  it("pays 2 per check-in and 8 per person once the whole roster made it", () => {
    const chapter = milestone("ana", activity, "Chapter 1");
    checkIn("ana", chapter);
    assert.equal(acornBalance(db, base), 2);
    checkIn("ben", chapter);
    assert.equal(acornBalance(db, base), 2 + 2 + 16);
    const together = db.acornEntries.filter((row) => row.kind === "together");
    assert.equal(together.length, 1);
    assert.equal(together[0]!.userId, "ben");
    assert.ok(
      db.events.some(
        (event) =>
          event.type === "acorns.together" && event.entityId === chapter,
      ),
    );
    parseDatabase(db);
  });

  it("does not require people who joined after the milestone was planned", () => {
    const chapter = milestone("ana", activity, "Chapter 2");
    // Cy joins the base later; joining initializes participation now.
    db.memberships.push({ id: "m_cy", connectionId: base, userId: "cy" });
    const cyJoinMilestone = db.milestones.find(
      (row) => row.activityId === activity && row.kind === "join",
    )!.id;
    db.participations.push({
      id: "p_cy",
      activityId: activity,
      userId: "cy",
      target: 5,
      status: "invited",
    });
    checkIn("cy", cyJoinMilestone);
    const before = acornBalance(db, base);
    checkIn("ana", chapter);
    checkIn("ben", chapter);
    assert.equal(acornBalance(db, base), before + 2 + 2 + 16);
    // Cy can still check in for their own 2 acorns, without a second bonus.
    checkIn("cy", chapter);
    assert.equal(acornBalance(db, base), before + 2 + 2 + 16 + 2);
  });

  it("gives nothing for milestone zero or a failed attempt", () => {
    const chapter = milestone("ana", activity, "Chapter 3");
    const before = acornBalance(db, base);
    run({
      type: "recordLog",
      actorId: "ana",
      input: {
        authorUserId: "ana",
        milestoneId: chapter,
        isSuccess: false,
        title: "Missed",
        durationMinutes: 0,
        origin: "manual",
      },
    });
    assert.equal(acornBalance(db, base), before);
  });

  it("refuses purchases the base cannot afford and charges nothing", () => {
    const balance = acornBalance(db, base);
    assert.throws(
      () =>
        run({
          type: "buyDecoration",
          actorId: "ana",
          homebaseId: base,
          itemId: "owl-statue",
          x: 96,
          y: 96,
        }),
      new RegExp(`costs 120 and your home base has ${balance}`),
    );
    assert.equal(acornBalance(db, base), balance);
    assert.equal(db.decorations.length, 0);
  });

  it("limits legendary items to one per home base and refunds returns in full", () => {
    // Top up through real check-ins on new milestones.
    while (acornBalance(db, base) < 240) {
      const extra = milestone("ana", activity, "Extra chapter");
      for (const person of people) checkIn(person, extra);
    }
    const before = acornBalance(db, base);
    const owl = run({
      type: "buyDecoration",
      actorId: "ben",
      homebaseId: base,
      itemId: "owl-statue",
      x: 96,
      y: 96,
    });
    assert.equal(acornBalance(db, base), before - 120);
    assert.throws(
      () =>
        run({
          type: "buyDecoration",
          actorId: "ana",
          homebaseId: base,
          itemId: "owl-statue",
          x: 208,
          y: 184,
        }),
      /already has this legendary item/,
    );
    run({ type: "returnDecoration", actorId: "ana", decorationId: owl });
    assert.equal(acornBalance(db, base), before);
    const purchase = db.acornEntries.find((row) => row.kind === "purchase")!;
    assert.equal(purchase.decorationId, null);
    assert.equal(purchase.note, "Watchful owl");
    parseDatabase(db);
  });

  it("moves decorations for free under the shared meadow rule", () => {
    const flower = run({
      type: "buyDecoration",
      actorId: "ana",
      homebaseId: base,
      itemId: "sunflower",
      x: 96,
      y: 96,
    });
    const balance = acornBalance(db, base);
    const oak = { x: 176, y: 112 };
    const move = (x: number, y: number, reserved = [oak]) =>
      run({
        type: "moveDecoration",
        actorId: "ben",
        decorationId: flower,
        x,
        y,
        reserved,
      });
    assert.throws(() => move(220, 144), /clear patch of lawn/); // the pond
    assert.throws(() => move(176, 104), /already taken/); // next to the oak
    assert.throws(
      () =>
        run({
          type: "buyDecoration",
          actorId: "ana",
          homebaseId: base,
          itemId: "pink-tulip",
          x: 104,
          y: 104,
        }),
      /already taken/,
    );
    move(48, 200);
    const moved = db.decorations.find((row) => row.id === flower)!;
    assert.deepEqual([moved.x, moved.y], [48, 200]);
    assert.equal(acornBalance(db, base), balance);
    assert.ok(db.events.some((event) => event.type === "decoration.moved"));
    const events = db.events.length;
    move(48, 200);
    assert.equal(db.events.length, events, "moving in place changes nothing");
    parseDatabase(db);
  });

  it("keeps earned acorns when the milestone is deleted", () => {
    const chapter = milestone("ana", activity, "Short-lived");
    checkIn("ana", chapter);
    const balance = acornBalance(db, base);
    run({ type: "deleteMilestone", actorId: "ana", milestoneId: chapter });
    assert.equal(acornBalance(db, base), balance);
    assert.ok(
      db.acornEntries.some(
        (row) => row.note === "Short-lived" && row.milestoneId === null,
      ),
    );
    parseDatabase(db);
  });
});

describe(
  "acorn shop over PostgreSQL",
  { skip: !process.env.TEST_DATABASE_URL },
  () => {
    let app: Awaited<ReturnType<typeof createApp>>;
    let alice: Session, bob: Session, stranger: Session;
    let baseId: string;
    let milestoneId: string;
    const nonce = crypto.randomUUID();
    const password = "test-only-password-12345";
    const auth = (session: Session) => ({
      Authorization: `Bearer ${session.token}`,
    });
    const server = () => app.getHttpServer();
    const state = async (session: Session): Promise<ApiState> =>
      (
        await request(server())
          .get("/api/v1/state")
          .set(auth(session))
          .expect(200)
      ).body;
    const balance = async (session: Session) =>
      (await state(session)).acornEntries
        .filter((row) => row.homebaseId === baseId)
        .reduce((sum, row) => sum + row.amount, 0);
    const register = async (name: string, inviteCode?: string) =>
      (
        await request(server())
          .post("/api/v1/auth/register")
          .send({
            name,
            email: `${name}.${nonce}@example.test`,
            password,
            inviteCode,
          })
          .expect(201)
      ).body as Session;
    const post = (session: Session, path: string, body: object) =>
      request(server()).post(`/api/v1/${path}`).set(auth(session)).send(body);
    const checkIn = (session: Session, externalKey: string) =>
      post(session, "logs", {
        milestoneId,
        isSuccess: true,
        title: "Read it",
        durationMinutes: 15,
        origin: "manual",
        externalKey,
      }).expect(200);
    const buy = (session: Session, body: object) =>
      post(session, "decorations", { homebaseId: baseId, ...body });

    before(async () => {
      process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
      app = await createApp(false);
      await app.init();
      alice = await register("Alice");
      const { body: bases } = await request(server())
        .get("/api/v1/homebases")
        .set(auth(alice))
        .expect(200);
      baseId = bases[0].id;
      bob = await register("Bob", bases[0].inviteCode);
      stranger = await register("Stranger");
      const activity = (
        await post(alice, "activities", {
          templateId: "read-book",
          name: "Read together",
          target: 3,
          connectionId: baseId,
        }).expect(201)
      ).body;
      milestoneId = (
        await post(alice, "milestones", {
          activityId: activity.entityId,
          parentId: null,
          name: "Chapter one",
          quantity: 1,
          policy: "open",
          startAt: null,
          endAt: null,
          itemId: null,
        }).expect(201)
      ).body.entityId;
    });
    after(async () => {
      await app.close();
    });

    it("publishes prices, tiers and earning rules", async () => {
      const { body } = await request(server())
        .get("/api/v1/shop")
        .set(auth(alice))
        .expect(200);
      assert.equal(body.currency.plural, "acorns");
      assert.deepEqual(
        body.tiers.map((tier: { price: number }) => tier.price),
        [10, 25, 50, 120],
      );
      assert.equal(body.listings.length, 8);
      assert.deepEqual(body.earning, { checkIn: 2, togetherPerPerson: 8 });
      const { body: spec } = await request(server())
        .get("/openapi.json")
        .expect(200);
      assert.ok(spec.paths["/api/v1/decorations"].post);
      assert.ok(spec.paths["/api/v1/decorations/{decorationId}"].delete);
      assert.ok(spec.paths["/api/v1/decorations/{decorationId}"].patch);
      assert.ok(
        spec.paths["/api/v1/homebases/{homebaseId}/garden/starter-oak"].patch,
      );
      assert.equal(
        spec.components.schemas.BuyDecoration.additionalProperties,
        false,
      );
    });

    it("rejects a purchase the base cannot afford without charging", async () => {
      const { body } = await buy(alice, {
        itemId: "sunflower",
        x: 96,
        y: 96,
      }).expect(400);
      assert.match(body.message, /costs 10 and your home base has 0/);
      assert.equal((await state(alice)).decorations.length, 0);
    });

    it("earns acorns from check-ins, once per retry, with a together bonus", async () => {
      await checkIn(alice, `alice-${nonce}`);
      await checkIn(alice, `alice-${nonce}`);
      assert.equal(await balance(alice), 2);
      await checkIn(bob, `bob-${nonce}`);
      assert.equal(await balance(bob), 20);
      const entries = (await state(alice)).acornEntries;
      assert.deepEqual(entries.map((row) => row.kind).sort(), [
        "check-in",
        "check-in",
        "together",
      ]);
      const stored = parseDatabase(
        await (async () => {
          const client = await app.get(DatabaseService).getPool().connect();
          try {
            return await loadDatabase(client);
          } finally {
            client.release();
          }
        })(),
      );
      assert.equal(acornBalance(stored, baseId), 20);
    });

    it("spends the shared pool, is idempotent, and survives concurrent buyers", async () => {
      const first = await buy(alice, {
        itemId: "sunflower",
        x: 96,
        y: 96,
        externalKey: `flower-${nonce}`,
      }).expect(201);
      const retry = await buy(alice, {
        itemId: "sunflower",
        x: 96,
        y: 96,
        externalKey: `flower-${nonce}`,
      }).expect(201);
      assert.equal(retry.body.entityId, first.body.entityId);
      assert.equal(retry.body.duplicate, true);
      assert.equal(await balance(alice), 10);
      const { body: taken } = await buy(bob, {
        itemId: "pink-tulip",
        x: 104,
        y: 104,
      }).expect(400);
      assert.match(taken.message, /already taken/);
      // With 10 acorns left, two members racing for 10-acorn items: only one wins.
      const results = await Promise.all([
        buy(alice, { itemId: "pink-tulip", x: 208, y: 184 }),
        buy(bob, { itemId: "sunflower", x: 48, y: 200 }),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
      assert.equal(await balance(bob), 0);
      const snapshot = await state(bob);
      assert.equal(snapshot.decorations.length, 2);
      assert.ok(
        snapshot.events.some((event) => event.type === "decoration.purchased"),
      );
    });

    it("lets any member return a decoration for a full refund", async () => {
      const [decoration] = (await state(bob)).decorations;
      await request(server())
        .delete(`/api/v1/decorations/${decoration!.id}`)
        .set(auth(bob))
        .expect(200);
      assert.equal(await balance(alice), decoration!.price);
    });

    it("moves decorations and the starter oak for free, keeping them apart", async () => {
      const before = await balance(alice);
      const [decoration] = (await state(alice)).decorations;
      const oakPath = `/api/v1/homebases/${baseId}/garden/starter-oak`;
      const moveTo = (session: Session, x: number, y: number) =>
        request(server())
          .patch(`/api/v1/decorations/${decoration!.id}`)
          .set(auth(session))
          .send({ x, y });
      await request(server())
        .patch(oakPath)
        .set(auth(alice))
        .send({ x: 104, y: 104 })
        .expect(404);
      await request(server())
        .post(oakPath)
        .set(auth(alice))
        .send({ x: 104, y: 104 })
        .expect(200);
      const { body: nearOak } = await moveTo(bob, 112, 104).expect(400);
      assert.match(nearOak.message, /already taken/);
      await moveTo(bob, 176, 112).expect(200);
      await moveTo(stranger, 176, 120).expect(400);
      const { body: onDecoration } = await request(server())
        .patch(oakPath)
        .set(auth(bob))
        .send({ x: 176, y: 104 })
        .expect(400);
      assert.match(onDecoration.message, /occupied/);
      await request(server())
        .patch(oakPath)
        .set(auth(bob))
        .send({ x: 40, y: 104 })
        .expect(200);
      const { body: onOak } = await buy(alice, {
        itemId: "pink-tulip",
        x: 40,
        y: 104,
      }).expect(400);
      assert.match(onOak.message, /already taken/);
      const snapshot = await state(alice);
      const moved = snapshot.decorations.find(
        (row) => row.id === decoration!.id,
      )!;
      assert.deepEqual([moved.x, moved.y], [176, 112]);
      assert.equal(await balance(alice), before, "moving is free");
      assert.ok(
        snapshot.events.some((event) => event.type === "decoration.moved"),
      );
      const { body: garden } = await request(server())
        .get(`/api/v1/homebases/${baseId}/garden`)
        .set(auth(alice))
        .expect(200);
      assert.deepEqual(garden.oak, { x: 40, y: 104, itemId: "oak-tree" });
    });

    it("keeps other home bases out of the pool", async () => {
      const outsider = await state(stranger);
      assert.equal(outsider.acornEntries.length, 0);
      assert.equal(outsider.decorations.length, 0);
      const { body } = await buy(stranger, {
        itemId: "sunflower",
        x: 96,
        y: 96,
      }).expect(400);
      assert.match(body.message, /not accessible/);
      const [decoration] = (await state(alice)).decorations;
      await request(server())
        .delete(`/api/v1/decorations/${decoration!.id}`)
        .set(auth(stranger))
        .expect(400);
    });
  },
);

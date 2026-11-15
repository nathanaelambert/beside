import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createSeed } from "@beside/domain/seed";
import { execute } from "@beside/domain/model";
import { gardenPlacements, tooClose } from "@beside/domain/garden";
import {
  gardenHistory,
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
// Two open spots far apart, from the shared placement rule itself.
const spots = gardenPlacements([]);
const spotA = spots[0]!;
const spotB = spots.find(
  (p) => Math.abs(p.x - spotA.x) > 40 || Math.abs(p.y - spotA.y) > 40,
)!;
// Open lawn, but too close to something standing on spotA.
const nearA = spots.find(
  (p) => tooClose(p, spotA) && (p.x !== spotA.x || p.y !== spotA.y),
)!;

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
  options: { at?: string; endAt?: string; buildOnId?: string } = {},
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
      policy: options.endAt ? "deadline" : "open",
      startAt: null,
      endAt: options.endAt ?? null,
      itemId,
      buildOnId: options.buildOnId,
    },
    options.at ?? now,
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

const place = (
  db: Database,
  objectId: string,
  point: { x: number; y: number },
  actorId = "mosaab",
) =>
  execute(db, { type: "placeGardenObject", actorId, objectId, ...point }, now)
    .db;

const objectsIn = (db: Database, homebaseId: string) =>
  db.gardenObjects.filter((o) => o.homebaseId === homebaseId);
const rewardOf = (db: Database, milestoneId: string) =>
  db.rewards.find(
    (r) => r.id === db.milestones.find((m) => m.id === milestoneId)!.rewardId,
  )!;

describe("precursor rewards in the domain", () => {
  it("locks a Christmas tree until an oak is planned, then decorates that oak in place", () => {
    let { db, homebaseId, activityId } = garden();
    assert.throws(
      () => plan(db, activityId, "christmas-tree"),
      /Christmas tree needs a Meadow oak in your garden first/,
    );
    const oak = plan(db, activityId, "oak-tree");
    db = oak.db;
    // A planned oak is a promise: the tree can be planned on it, and waits.
    const queued = rewardStatus(db, homebaseId, "christmas-tree", now);
    assert.equal(queued.kind, "queued");
    const tree = plan(db, activityId, "christmas-tree", { at: later(1) });
    db = tree.db;
    assert.equal(
      rewardOf(db, tree.entityId).targetRewardId,
      rewardOf(db, oak.entityId).id,
    );
    // That oak is claimed now, so a second tree has nothing to build on.
    assert.throws(
      () => plan(db, activityId, "christmas-tree", { at: later(2) }),
      /needs a Meadow oak/,
    );

    db = complete(db, oak.entityId, later(3));
    const [earned] = objectsIn(db, homebaseId);
    // Earned items arrive unplaced; a member chooses the spot.
    assert.deepEqual(
      { itemId: earned!.itemId, x: earned!.x, y: earned!.y },
      { itemId: "oak-tree", x: null, y: null },
    );
    assert.ok(db.events.some((e) => e.type === "garden.earned"));
    db = place(db, earned!.id, spotA);

    db = complete(db, tree.entityId, later(4));
    const [decorated] = objectsIn(db, homebaseId);
    assert.equal(objectsIn(db, homebaseId).length, 1);
    assert.equal(decorated!.id, earned!.id);
    assert.equal(decorated!.itemId, "christmas-tree");
    assert.deepEqual([decorated!.x, decorated!.y], [spotA.x, spotA.y]);
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

  it("lets the planner pick which oak to decorate, including the starter oak", () => {
    let { db, homebaseId, activityId } = garden();
    db.gardenObjects.push({
      id: "garden_starter_test",
      homebaseId,
      itemId: "oak-tree",
      origin: "starter",
      ...spotA,
      createdAt: now,
      updatedAt: now,
    });
    const oak = plan(db, activityId, "oak-tree");
    db = complete(oak.db, oak.entityId, later(1));
    const earned = objectsIn(db, homebaseId).find(
      (o) => o.origin === "reward",
    )!;
    db = place(db, earned.id, spotB);
    const ready = rewardStatus(db, homebaseId, "christmas-tree", later(2));
    assert.equal(ready.kind, "ready");
    assert.deepEqual(
      ready.kind === "ready" &&
        ready.candidates.map((c) => c.kind === "object" && c.object.id),
      ["garden_starter_test", earned.id],
    );
    // Something that is not a free oak cannot be chosen.
    assert.throws(
      () =>
        plan(db, activityId, "christmas-tree", {
          at: later(3),
          buildOnId: rewardOf(db, oak.entityId).id,
        }),
      /Choose a free Meadow oak for Christmas tree to build on/,
    );
    const tree = plan(db, activityId, "christmas-tree", {
      at: later(3),
      buildOnId: "garden_starter_test",
    });
    db = complete(tree.db, tree.entityId, later(4));
    const byId = (id: string) => db.gardenObjects.find((o) => o.id === id)!;
    assert.equal(byId("garden_starter_test").itemId, "christmas-tree");
    assert.equal(byId(earned.id).itemId, "oak-tree");
    parseDatabase(structuredClone(db));
  });

  it("builds a cottage stage by stage on one object, and lands an early stage once its precursor exists", () => {
    let { db, homebaseId, activityId } = garden();
    const stages = [
      "cottage-foundation",
      "cottage-walls",
      "cottage-roof",
      "cottage",
    ];
    assert.throws(
      () => plan(db, activityId, "cottage-roof"),
      /Cottage roof needs Cottage walls in your garden/,
    );
    const ids: string[] = [];
    // Each planned stage unlocks planning the next one on top of it.
    for (const [index, itemId] of stages.entries()) {
      assert.equal(
        rewardStatus(db, homebaseId, itemId, later(index)).kind,
        index ? "queued" : "place",
      );
      const planned = plan(db, activityId, itemId, { at: later(index) });
      db = planned.db;
      ids.push(planned.entityId);
    }
    const catalog = homebaseRewards(db, homebaseId, later(5));
    assert.deepEqual(
      catalog.items
        .filter((item) => stages.includes(item.itemId))
        .map((item) => [item.itemId, item.status.kind, item.planned]),
      [
        // Each planned stage already claims the one below it.
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
    db = complete(db, ids[0]!, later(11));
    let [house] = objectsIn(db, homebaseId);
    assert.equal(house!.itemId, "cottage-walls");
    db = place(db, house!.id, spotA);
    for (const [index, id] of ids.slice(2).entries()) {
      db = complete(db, id, later(12 + index));
      [house] = objectsIn(db, homebaseId);
      assert.equal(house!.itemId, stages[index + 2]);
      assert.deepEqual([house!.x, house!.y], [spotA.x, spotA.y]);
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

  it("places and moves objects only on open lawn clear of everything else", () => {
    let { db, homebaseId, activityId } = garden();
    for (const itemId of ["oak-tree", "sunflower"]) {
      const planned = plan(db, activityId, itemId);
      db = complete(planned.db, planned.entityId, later(1));
    }
    const [oak, flower] = objectsIn(db, homebaseId);
    db = place(db, oak!.id, spotA);
    assert.throws(
      () => place(db, flower!.id, nearA),
      /Something already stands there/,
    );
    // The pond is not lawn.
    assert.throws(
      () => place(db, flower!.id, { x: 224, y: 152 }),
      /Choose a clear patch of lawn/,
    );
    assert.throws(
      () => place(db, flower!.id, spotB, "rishik"),
      /not accessible/,
    );
    db = place(db, flower!.id, spotB);
    // Moving is free and keeps the object; it may move next to its old spot.
    db = place(db, oak!.id, nearA);
    const moved = db.gardenObjects.find((o) => o.id === oak!.id)!;
    assert.deepEqual([moved.x, moved.y], [nearA.x, nearA.y]);
    assert.ok(db.events.some((e) => e.type === "garden.moved"));
    parseDatabase(structuredClone(db));
  });

  it("releases a claim when an upgrade's window closes unearned, and detaches upgrades from a deleted precursor", () => {
    let { db, homebaseId, activityId } = garden();
    const oak = plan(db, activityId, "oak-tree");
    db = complete(oak.db, oak.entityId);
    const missed = plan(db, activityId, "christmas-tree", {
      endAt: later(30),
    });
    db = missed.db;
    assert.equal(
      rewardStatus(db, homebaseId, "christmas-tree", later(10)).kind,
      "locked",
    );
    assert.equal(
      rewardStatus(db, homebaseId, "christmas-tree", later(31)).kind,
      "ready",
    );
    // Deleting the oak's milestone keeps the oak itself.
    db = execute(
      db,
      { type: "deleteMilestone", actorId: "mosaab", milestoneId: oak.entityId },
      later(40),
    ).db;
    assert.equal(objectsIn(db, homebaseId)[0]!.itemId, "oak-tree");

    const foundation = plan(db, activityId, "cottage-foundation", {
      at: later(41),
    });
    const walls = plan(foundation.db, activityId, "cottage-walls", {
      at: later(42),
    });
    db = execute(
      walls.db,
      {
        type: "deleteMilestone",
        actorId: "mosaab",
        milestoneId: foundation.entityId,
      },
      later(43),
    ).db;
    assert.equal(rewardOf(db, walls.entityId).targetRewardId, null);
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
    const plan = (itemId: string, status = 201, buildOnId?: string) =>
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
          ...(buildOnId ? { buildOnId } : {}),
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

    it("serves the precursor catalog, the garden and the place route in the contract", async () => {
      const { body } = await http().get("/openapi.json").expect(200);
      assert.ok(body.paths["/api/v1/homebases/{homebaseId}/rewards"].get);
      assert.ok(body.paths["/api/v1/garden"].get);
      assert.ok(body.paths["/api/v1/garden/{objectId}/place"].post);
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

    it("decorates the chosen starter oak, then places and moves an earned oak", async () => {
      await http()
        .post(`/api/v1/homebases/${homebaseId}/garden/starter-oak`)
        .set(auth(ada))
        .send(spotA)
        .expect(200);
      const [starter] = (await state(ben)).gardenObjects;
      assert.deepEqual(
        { origin: starter!.origin, itemId: starter!.itemId },
        { origin: "starter", itemId: "oak-tree" },
      );
      const ready = (await rewards(ben)).items.find(
        (i) => i.itemId === "christmas-tree",
      )!;
      assert.equal(ready.status.kind, "ready");
      const tree = (await plan("christmas-tree", 201, starter!.id)).body
        .entityId;
      await attend(ada, tree);
      await attend(ben, tree);
      const replay = await attend(ben, tree);
      assert.equal(replay.body.duplicate, true);
      // PR #14's endpoint reports the starter at its current stage.
      const { body: garden } = await http()
        .get(`/api/v1/homebases/${homebaseId}/garden`)
        .set(auth(ada))
        .expect(200);
      assert.deepEqual(garden.oak, { ...spotA, itemId: "christmas-tree" });

      const oak = (await plan("oak-tree")).body.entityId;
      await attend(ada, oak);
      await attend(ben, oak);
      const earned = (await state(ada)).gardenObjects.find(
        (o) => o.origin === "reward",
      )!;
      assert.deepEqual([earned.x, earned.y], [null, null]);
      const placeAt = (point: { x: number; y: number }, status: number) =>
        http()
          .post(`/api/v1/garden/${earned.id}/place`)
          .set(auth(ben))
          .send(point)
          .expect(status);
      const taken = await placeAt(nearA, 400);
      assert.match(taken.body.message, /Something already stands there/);
      await placeAt(spotB, 200);
      const nearB = spots.find(
        (p) => tooClose(p, spotB) && (p.x !== spotB.x || p.y !== spotB.y),
      )!;
      await placeAt(nearB, 200);
      const { body: objects } = await http()
        .get("/api/v1/garden")
        .set(auth(ada))
        .expect(200);
      assert.deepEqual(
        objects.map((o: { itemId: string; x: number; y: number }) => [
          o.itemId,
          o.x,
          o.y,
        ]),
        [
          ["christmas-tree", spotA.x, spotA.y],
          ["oak-tree", nearB.x, nearB.y],
        ],
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
      // Foundations are planned, but the cottage still needs a roof.
      const locked = await http()
        .post(`/api/v1/activities/${activityId}/schedules`)
        .set(auth(ada))
        .send(schedule("cottage", 1))
        .expect(400);
      assert.match(locked.body.message, /Cosy cottage needs a Cottage roof/);
    });
  },
);

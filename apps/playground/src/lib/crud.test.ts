import assert from "node:assert/strict";
import { test } from "node:test";
import { createSeed } from "./seed.ts";
import { execute, participation, progress } from "./model.ts";
import { parseDatabase } from "./validation.ts";
import type { Command, Database } from "./types.ts";

const run = (db: Database, command: Command) =>
  execute(db, command, "2026-11-01T00:00:00.000Z");
const plan = (
  db: Database,
  activityId: string,
  parentId: string | null = null,
) =>
  run(db, {
    type: "createMilestone",
    actorId: "mosaab",
    activityId,
    parentId,
    name: "CRUD milestone",
    quantity: 2,
    policy: "open",
    startAt: null,
    endAt: null,
    itemId: "oak-tree",
  });

test("any member can rename a home base and edit an activity, while outsiders cannot", () => {
  let db = createSeed();
  const base = db.connections.find((base) => base.id === "mn")!;
  const activity = db.activities.find(
    (activity) => activity.connectionId === base.id,
  )!;
  const other = participation(db, activity.id, "nathaniel")!.target;
  const myTarget = participation(db, activity.id, "mosaab")!.target;
  db = run(db, {
    type: "updateHomebase",
    actorId: "nathaniel",
    homebaseId: base.id,
    name: " Renamed base ",
  }).db;
  db = run(db, {
    type: "updateActivity",
    actorId: "nathaniel",
    activityId: activity.id,
    changes: { name: "Renamed activity", description: "Updated", target: 21 },
  }).db;
  assert.equal(
    db.connections.find((row) => row.id === base.id)!.name,
    "Renamed base",
  );
  assert.equal(
    db.activities.find((row) => row.id === activity.id)!.name,
    "Renamed activity",
  );
  assert.equal(participation(db, activity.id, "nathaniel")!.target, 21);
  assert.equal(participation(db, activity.id, "mosaab")!.target, myTarget);
  assert.notEqual(other, 21);
  for (const command of [
    { type: "deleteHomebase", actorId: "rishik", homebaseId: base.id },
    {
      type: "updateHomebase",
      actorId: "rishik",
      homebaseId: base.id,
      name: "Forbidden",
    },
    { type: "deleteActivity", actorId: "rishik", activityId: activity.id },
    {
      type: "updateActivity",
      actorId: "rishik",
      activityId: activity.id,
      changes: { name: "Forbidden" },
    },
  ] as Command[])
    assert.throws(() => run(db, command), /not accessible/);
  assert.ok(parseDatabase(db));
});

test("milestone editing validates ancestry and schedules, preserves reward rosters, and freezes logged rules", () => {
  let db = createSeed();
  const activity = db.activities.find(
    (activity) => activity.connectionId === "mn",
  )!;
  const planned = plan(db, activity.id);
  db = planned.db;
  const child = plan(db, activity.id, planned.entityId);
  db = child.db;
  const reward = db.rewards.find(
    (row) =>
      row.id ===
      db.milestones.find((row) => row.id === planned.entityId)!.rewardId,
  )!;
  const roster = [...reward.requiredUserIds];
  db = run(db, {
    type: "updateMilestone",
    actorId: "mosaab",
    milestoneId: planned.entityId,
    changes: {
      name: "New milestone",
      quantity: 3,
      itemId: "sunflower",
      parentId: null,
    },
  }).db;
  assert.deepEqual(
    db.rewards.find((row) => row.id === reward.id)!.requiredUserIds,
    roster,
  );
  assert.equal(
    db.rewards.find((row) => row.id === reward.id)!.itemId,
    "sunflower",
  );
  assert.throws(
    () =>
      run(db, {
        type: "updateMilestone",
        actorId: "mosaab",
        milestoneId: planned.entityId,
        changes: { parentId: child.entityId },
      }),
    /descendant/,
  );
  assert.throws(() =>
    run(db, {
      type: "updateMilestone",
      actorId: "mosaab",
      milestoneId: planned.entityId,
      changes: { policy: "paced", startAt: null, endAt: null },
    }),
  );
  db = run(db, {
    type: "recordLog",
    actorId: "mosaab",
    input: {
      authorUserId: "mosaab",
      milestoneId: planned.entityId,
      isSuccess: true,
      title: "Done",
      durationMinutes: 0,
      occurredAt: "2026-11-01T00:00:00.000Z",
      origin: "manual",
    },
  }).db;
  const logs = structuredClone(db.logs),
    credits = structuredClone(db.contributions);
  for (const changes of [
    { quantity: 4 },
    { itemId: null },
    { policy: "deadline" as const, endAt: "2026-12-01T00:00:00.000Z" },
  ])
    assert.throws(
      () =>
        run(db, {
          type: "updateMilestone",
          actorId: "mosaab",
          milestoneId: planned.entityId,
          changes,
        }),
      /has logs/,
    );
  db = run(db, {
    type: "updateMilestone",
    actorId: "mosaab",
    milestoneId: planned.entityId,
    changes: { name: "Clearer title" },
  }).db;
  assert.deepEqual(db.logs, logs);
  assert.deepEqual(db.contributions, credits);
  assert.ok(parseDatabase(db));
});

test("deleting a milestone removes descendants, logs, earned rewards and credit while preserving siblings", () => {
  let db = createSeed();
  const activity = db.activities.find(
    (activity) => activity.connectionId === "personal_mosaab",
  )!;
  const parent = plan(db, activity.id);
  db = parent.db;
  const child = plan(db, activity.id, parent.entityId);
  db = child.db;
  db = run(db, {
    type: "recordLog",
    actorId: "mosaab",
    input: {
      authorUserId: "mosaab",
      milestoneId: child.entityId,
      isSuccess: true,
      title: "Done child",
      durationMinutes: 0,
      occurredAt: "2026-11-01T00:00:00.000Z",
      origin: "manual",
    },
  }).db;
  const rewardId = db.milestones.find(
    (row) => row.id === child.entityId,
  )!.rewardId!;
  assert.ok(db.rewards.find((row) => row.id === rewardId)!.obtainedAt);
  const person = participation(db, activity.id, "mosaab")!;
  const before = progress(db, person).value;
  const siblingIds = db.milestones
    .filter(
      (row) =>
        row.activityId === activity.id &&
        ![parent.entityId, child.entityId].includes(row.id),
    )
    .map((row) => row.id);
  db = run(db, {
    type: "deleteMilestone",
    actorId: "mosaab",
    milestoneId: parent.entityId,
  }).db;
  assert.ok(
    !db.milestones.some((row) =>
      [parent.entityId, child.entityId].includes(row.id),
    ),
  );
  assert.ok(!db.logs.some((row) => row.milestoneId === child.entityId));
  assert.ok(!db.rewards.some((row) => row.id === rewardId));
  assert.ok(progress(db, person).value < before);
  assert.ok(
    siblingIds.every((id) => db.milestones.some((row) => row.id === id)),
  );
  assert.ok(parseDatabase(db));
});

test("activity and home-base deletion remove their graphs, retaining accounts, subjects and unrelated history", () => {
  const initial = createSeed();
  const activity = initial.activities.find((row) => row.connectionId === "mn")!;
  const subjects = structuredClone(initial.subjects),
    users = structuredClone(initial.users);
  let db = run(initial, {
    type: "deleteActivity",
    actorId: "nathaniel",
    activityId: activity.id,
  }).db;
  assert.ok(!db.activities.some((row) => row.id === activity.id));
  assert.ok(!db.participations.some((row) => row.activityId === activity.id));
  assert.ok(!db.milestones.some((row) => row.activityId === activity.id));
  assert.deepEqual(db.subjects, subjects);
  assert.deepEqual(db.users, users);
  assert.ok(parseDatabase(db));
  const unrelated = db.activities.filter((row) => row.connectionId !== "mn");
  db = run(db, {
    type: "deleteHomebase",
    actorId: "mosaab",
    homebaseId: "mn",
  }).db;
  assert.ok(!db.connections.some((row) => row.id === "mn"));
  assert.ok(!db.memberships.some((row) => row.connectionId === "mn"));
  assert.ok(!db.logShares.some((row) => row.connectionId === "mn"));
  assert.ok(!db.deliveries.some((row) => row.connectionId === "mn"));
  assert.deepEqual(
    db.activities.filter((row) => row.connectionId !== "mn"),
    unrelated,
  );
  assert.deepEqual(db.subjects, subjects);
  assert.deepEqual(db.users, users);
  assert.ok(parseDatabase(db));
});

test("milestone zero cannot be edited or deleted separately", () => {
  const db = createSeed();
  const root = db.milestones.find(
    (row) =>
      row.kind === "join" &&
      db.activities.find((activity) => activity.id === row.activityId)!
        .connectionId === "mn",
  )!;
  assert.throws(
    () =>
      run(db, {
        type: "deleteMilestone",
        actorId: "mosaab",
        milestoneId: root.id,
      }),
    /Milestone zero/,
  );
  assert.throws(
    () =>
      run(db, {
        type: "updateMilestone",
        actorId: "mosaab",
        milestoneId: root.id,
        changes: { name: "Edit" },
      }),
    /Milestone zero/,
  );
});

test("the local experiment can create a replacement home base after deleting its bases", () => {
  let db = createSeed();
  for (const base of db.connections.filter((base) =>
    db.memberships.some(
      (member) => member.userId === "mosaab" && member.connectionId === base.id,
    ),
  ))
    db = run(db, {
      type: "deleteHomebase",
      actorId: "mosaab",
      homebaseId: base.id,
    }).db;
  const created = run(db, {
    type: "createHomebase",
    actorId: "mosaab",
    name: "Start again",
  });
  assert.equal(
    created.db.connections.find((base) => base.id === created.entityId)!.name,
    "Start again",
  );
  assert.ok(
    created.db.memberships.some(
      (member) =>
        member.connectionId === created.entityId && member.userId === "mosaab",
    ),
  );
  assert.ok(parseDatabase(created.db));
});

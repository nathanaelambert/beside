import { test } from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "./seed.ts";
import {
  completedMilestone,
  execute,
  homebaseForActivity,
  participation,
  progress,
  visibleActivities,
  visibleLogs,
  visibleSubjects,
} from "./model.ts";
import { parseDatabase } from "./validation.ts";
import type { Command, Database, LogInput, LoggingPolicy } from "./types.ts";

const now = "2026-10-21T18:00:00.000Z";
const book = (db: Database) =>
  db.activities.find((a) => a.name === "Dune, together")!;
const chapter = (db: Database, n = 1) =>
  db.milestones.find(
    (m) => m.activityId === book(db).id && m.name === `Chapter ${n}`,
  )!;
const input = (db: Database, overrides: Partial<LogInput> = {}): LogInput => ({
  authorUserId: "mosaab",
  milestoneId: chapter(db).id,
  isSuccess: true,
  title: "A chapter today",
  durationMinutes: 30,
  occurredAt: now,
  origin: "manual",
  ...overrides,
});
const record = (
  db: Database,
  overrides: Partial<LogInput> = {},
  time = now,
) => {
  const payload = input(db, overrides);
  return execute(
    db,
    { type: "recordLog", actorId: payload.authorUserId, input: payload },
    time,
  );
};
const plan = (
  db: Database,
  overrides: Partial<Extract<Command, { type: "createMilestone" }>> = {},
) =>
  execute(
    db,
    {
      type: "createMilestone",
      actorId: "mosaab",
      activityId: book(db).id,
      name: "New achievement",
      parentId: null,
      quantity: 1,
      policy: "open",
      startAt: null,
      endAt: null,
      itemId: null,
      ...overrides,
    },
    now,
  );

test("one milestone log credits only its own activity, leaves other milestones and people unchanged, and has the home-base audience", () => {
  const before = createSeed();
  const result = record(before, { milestoneId: chapter(before, 5).id });
  const db = result.db;
  assert.equal(db.logs.length, before.logs.length + 1);
  assert.equal(
    db.contributions.filter((c) => c.logId === result.entityId).length,
    1,
  );
  assert.deepEqual(
    db.logShares
      .filter((s) => s.logId === result.entityId)
      .map((s) => s.connectionId),
    ["mn"],
  );
  assert.equal(
    progress(db, participation(db, book(db).id, "mosaab")!).value,
    5,
  );
  assert.equal(
    progress(db, participation(db, book(db).id, "nathaniel")!).value,
    4,
  );
  assert.equal(completedMilestone(db, chapter(db, 3).id, "mosaab"), false);
  const habit = db.activities.find(
    (a) => a.name === "A little reading, often",
  )!;
  assert.equal(progress(db, participation(db, habit.id, "mosaab")!).value, 0);
  assert.ok(!visibleLogs(db, "rishik").some((l) => l.id === result.entityId));
  assert.ok(parseDatabase(db));
});

test("every new log requires one milestone and cannot provide arbitrary facts or multiple credits", () => {
  const db = createSeed();
  for (const payload of [
    { ...input(db), milestoneId: undefined },
    { ...input(db), milestoneId: [chapter(db).id] },
    { ...input(db), activityIds: [book(db).id] },
    { ...input(db), quantity: 100 },
    { ...input(db), occurredAt: "yesterday" },
    { ...input(db), durationMinutes: NaN },
  ])
    assert.throws(() =>
      execute(db, {
        type: "recordLog",
        actorId: "mosaab",
        input: payload as unknown as LogInput,
      }),
    );
  assert.throws(
    () =>
      execute(db, { type: "recordLog", actorId: "rishik", input: input(db) }),
    /selected author/,
  );
  assert.throws(() => record(db, { authorUserId: "rishik" }), /not accessible/);
});

test("success is once per user even for a different source or request key; failure can precede success", () => {
  const initial = createSeed();
  const failed = record(initial, { isSuccess: false }).db;
  assert.equal(failed.contributions.length, initial.contributions.length);
  assert.equal(
    failed.rewards.find((r) => r.id === chapter(failed).rewardId)!.obtainedAt,
    null,
  );
  const first = record(failed).db;
  assert.throws(() => record(first), /already completed/);
  assert.throws(() => record(first, { isSuccess: false }), /already completed/);
  assert.throws(
    () => record(first, { origin: "mcp", externalKey: "different" }),
    /already completed/,
  );
  const second = record(first, { authorUserId: "nathaniel" }).db;
  assert.equal(
    second.logs.filter(
      (l) => l.milestoneId === chapter(second).id && l.isSuccess,
    ).length,
    2,
  );
  assert.ok(parseDatabase(second));
});

test("all required participants unlock one item for the whole home base, once", () => {
  let db = createSeed();
  const rewardId = chapter(db).rewardId!;
  assert.deepEqual(
    db.rewards.find((r) => r.id === rewardId)!.requiredUserIds.sort(),
    ["mosaab", "nathaniel"],
  );
  db = record(db).db;
  assert.equal(db.rewards.find((r) => r.id === rewardId)!.obtainedAt, null);
  db = record(db, { authorUserId: "nathaniel" }).db;
  const reward = db.rewards.find((r) => r.id === rewardId)!;
  assert.equal(reward.homebaseId, "mn");
  assert.equal(reward.itemId, "oak-tree");
  assert.equal(reward.obtainedAt, now);
  const events = db.events.filter(
    (e) => e.type === "reward.obtained" && e.entityId === rewardId,
  );
  assert.equal(events.length, 1);
  assert.deepEqual(
    db.deliveries
      .filter((d) => d.eventId === events[0]!.id)
      .map((d) => d.recipientUserId)
      .sort(),
    ["mosaab", "nathaniel"],
  );
  assert.ok(parseDatabase(db));
});

test("voice, MCP, automation and manual retries return the original log before checking closed schedules or repeat success", () => {
  for (const origin of ["manual", "voice", "mcp", "automation"] as const) {
    const initial = createSeed();
    const first = record(initial, { origin, externalKey: "  request-1  " });
    const retry = record(
      first.db,
      { origin, externalKey: "request-1" },
      "2026-12-31T18:00:00.000Z",
    );
    assert.equal(retry.duplicate, true);
    assert.equal(retry.entityId, first.entityId);
    assert.equal(retry.db, first.db);
    assert.equal(retry.db.events.length, first.db.events.length);
    assert.ok(parseDatabase(retry.db));
  }
});

test("milestone zero is first and automatically logged once for every participant, without progress or rewards", () => {
  const initial = createSeed();
  const created = execute(
    initial,
    {
      type: "createActivity",
      actorId: "mosaab",
      templateId: "read-book",
      name: "A new book",
      description: "",
      connectionId: "mn",
      subjectIds: [],
      target: 5,
    },
    now,
  );
  const root = created.db.milestones.find(
    (m) => m.activityId === created.entityId,
  )!;
  assert.equal(root.kind, "join");
  assert.equal(root.parentId, root.id);
  assert.equal(
    participation(created.db, created.entityId, "mosaab")!.status,
    "active",
  );
  assert.equal(
    participation(created.db, created.entityId, "nathaniel")!.status,
    "active",
  );
  assert.equal(created.db.contributions.length, initial.contributions.length);
  const join = {
    ...input(created.db),
    authorUserId: "nathaniel",
    milestoneId: root.id,
  };
  for (const userId of ["mosaab", "nathaniel"]) {
    const first = created.db.logs.filter(
      (l) => l.authorUserId === userId && l.milestoneId === root.id,
    );
    assert.equal(first.length, 1);
    assert.equal(first[0]!.isSuccess, true);
    assert.equal(first[0]!.origin, "automation");
    assert.equal(first[0]!.createdAt, now);
  }
  const joined = created.db;
  assert.throws(
    () =>
      execute(
        joined,
        { type: "recordLog", actorId: "nathaniel", input: join },
        now,
      ),
    /already joined/,
  );
  assert.equal(
    participation(joined, created.entityId, "nathaniel")!.status,
    "active",
  );
  const left = execute(
    joined,
    {
      type: "recordLog",
      actorId: "nathaniel",
      input: { ...join, isSuccess: false },
    },
    now,
  ).db;
  assert.equal(
    participation(left, created.entityId, "nathaniel")!.status,
    "left",
  );
  assert.throws(
    () =>
      execute(
        left,
        { type: "recordLog", actorId: "nathaniel", input: join },
        now,
      ),
    /already joined/,
  );
  assert.ok(parseDatabase(left));
});

test("leaving cannot lower a reward's saved cooperation requirement", () => {
  let db = createSeed();
  const root = db.milestones.find(
    (m) => m.kind === "join" && m.activityId === book(db).id,
  )!;
  db = record(db, {
    authorUserId: "nathaniel",
    milestoneId: root.id,
    isSuccess: false,
  }).db;
  db = record(db).db;
  const reward = db.rewards.find((r) => r.id === chapter(db).rewardId)!;
  assert.deepEqual(reward.requiredUserIds, ["mosaab", "nathaniel"]);
  assert.equal(reward.obtainedAt, null);
  assert.throws(
    () => record(db, { authorUserId: "nathaniel" }),
    /Join the activity/,
  );
});

test("paced windows reject early/late submissions, include exact boundaries, and cannot be bypassed by backdating", () => {
  const planned = plan(createSeed(), {
    policy: "paced",
    startAt: "2026-10-21T19:00:00.000Z",
    endAt: "2026-10-21T20:00:00.000Z",
  });
  const milestoneId = planned.entityId;
  assert.throws(() => record(planned.db, { milestoneId }), /not started/);
  for (const time of ["2026-10-21T19:00:00.000Z", "2026-10-21T20:00:00.000Z"])
    assert.ok(
      parseDatabase(
        record(planned.db, { milestoneId, occurredAt: time }, time).db,
      ),
    );
  assert.throws(
    () =>
      record(
        planned.db,
        { milestoneId, occurredAt: "2026-10-21T19:30:00.000Z" },
        "2026-10-21T20:00:00.001Z",
      ),
    /closed/,
  );
});

test("deadline policy allows several milestones in one session, rejects late reports; open permits any submission time", () => {
  const first = plan(createSeed(), {
    policy: "deadline",
    endAt: "2026-10-22T18:00:00.000Z",
  });
  const second = plan(first.db, {
    name: "Another unit",
    policy: "deadline",
    endAt: "2026-10-22T18:00:00.000Z",
  });
  let db = record(second.db, { milestoneId: first.entityId }).db;
  db = record(db, { milestoneId: second.entityId }).db;
  assert.ok(parseDatabase(db));
  assert.throws(
    () =>
      record(
        first.db,
        { milestoneId: first.entityId },
        "2026-10-23T18:00:00.000Z",
      ),
    /closed/,
  );
  assert.ok(record(createSeed(), {}, "2026-12-31T18:00:00.000Z"));
  assert.throws(
    () => record(createSeed(), { occurredAt: "2027-01-01T18:00:00.000Z" }),
    /future/,
  );
});

test("invalid schedules, cross-activity parents, inaccessible activities and missing items roll back the full plan", () => {
  const db = createSeed();
  const snapshot = structuredClone(db);
  for (const overrides of [
    { policy: "paced" as LoggingPolicy },
    { policy: "deadline" as LoggingPolicy },
    { policy: "open" as LoggingPolicy, endAt: now },
    {
      policy: "paced" as LoggingPolicy,
      startAt: now,
      endAt: "2026-10-20T18:00:00.000Z",
    },
    { parentId: db.milestones.find((m) => m.activityId !== book(db).id)!.id },
    { itemId: "missing-item" },
    { quantity: Infinity },
    { actorId: "rishik" },
  ])
    assert.throws(() => plan(db, overrides));
  assert.deepEqual(db, snapshot);
});

test("nested milestones do not imply completion of parent or siblings", () => {
  const parent = plan(createSeed());
  const child = plan(parent.db, {
    parentId: parent.entityId,
    name: "A nested chapter",
  });
  const result = record(child.db, { milestoneId: child.entityId });
  assert.equal(completedMilestone(result.db, parent.entityId, "mosaab"), false);
  assert.ok(parseDatabase(result.db));
});

test("position, sum and session activities preserve their progress interpretation with one contribution per success", () => {
  let db = createSeed();
  for (const n of [5, 3])
    db = record(db, { milestoneId: chapter(db, n).id }).db;
  assert.equal(
    progress(db, participation(db, book(db).id, "mosaab")!).value,
    5,
  );
  const french = db.activities.find((a) => a.name === "A little French")!;
  const steps = db.milestones.filter(
    (m) => m.activityId === french.id && m.kind === "achievement",
  );
  for (const step of steps.slice(0, 2))
    db = record(db, { milestoneId: step.id }).db;
  assert.equal(progress(db, participation(db, french.id, "mosaab")!).value, 40);
  assert.equal(homebaseForActivity(db, french)!.personalOwnerId, "mosaab");
  const habit = db.activities.find(
    (a) => a.name === "A little reading, often",
  )!;
  const step = db.milestones.find(
    (m) => m.activityId === habit.id && m.kind === "achievement",
  )!;
  db = record(db, { milestoneId: step.id }).db;
  assert.equal(progress(db, participation(db, habit.id, "mosaab")!).value, 1);
  assert.ok(parseDatabase(db));
});

test("personal milestones stay private, while later sharing changes visibility without adding credit", () => {
  const db = createSeed();
  const activity = db.activities.find((a) => a.name === "A little French")!;
  const milestone = db.milestones.find(
    (m) => m.activityId === activity.id && m.kind === "achievement",
  )!;
  const saved = record(db, { milestoneId: milestone.id });
  assert.ok(
    !visibleLogs(saved.db, "nathaniel").some((l) => l.id === saved.entityId),
  );
  const shared = execute(
    saved.db,
    {
      type: "distributeLog",
      actorId: "mosaab",
      logId: saved.entityId,
      connectionIds: ["mn"],
    },
    now,
  );
  assert.ok(
    visibleLogs(shared.db, "nathaniel").some((l) => l.id === saved.entityId),
  );
  assert.equal(shared.db.contributions.length, saved.db.contributions.length);
  assert.throws(() =>
    execute(
      saved.db,
      {
        type: "distributeLog",
        actorId: "mosaab",
        logId: saved.entityId,
        connectionIds: ["nm"],
      },
      now,
    ),
  );
  const replay = execute(
    shared.db,
    {
      type: "distributeLog",
      actorId: "mosaab",
      logId: saved.entityId,
      connectionIds: ["mn"],
    },
    now,
  );
  assert.equal(replay.db.events.length, shared.db.events.length);
  assert.ok(parseDatabase(shared.db));
});

test("imports reject broken milestone/reward references, cycles, false grants, duplicate successes and wrong-activity credit", () => {
  const base = record(createSeed()).db;
  const mutations: ((db: Database) => void)[] = [
    (db) => {
      chapter(db).parentId = chapter(db).id;
    },
    (db) => {
      chapter(db).parentId = "missing";
    },
    (db) => {
      chapter(db).rewardId = "missing";
    },
    (db) => {
      db.rewards.find((r) => r.id === chapter(db).rewardId)!.homebaseId = "mm";
    },
    (db) => {
      db.rewards.find((r) => r.id === chapter(db).rewardId)!.obtainedAt = now;
    },
    (db) => {
      db.logs.push({ ...db.logs.at(-1)!, id: "duplicate-success" });
    },
    (db) => {
      db.logs.at(-1)!.milestoneId = "missing";
    },
    (db) => {
      db.contributions.at(-1)!.amount = 999;
    },
    (db) => {
      db.contributions.at(-1)!.participationId = db.participations.find(
        (p) => p.userId === "mosaab" && p.activityId !== book(db).id,
      )!.id;
    },
    (db) => {
      db.milestones.splice(
        db.milestones.findIndex((m) => m.kind === "join"),
        1,
      );
    },
    (db) => {
      db.rewards.at(-1)!.requiredUserIds.push("missing-user");
    },
  ];
  for (const mutate of mutations) {
    const broken = structuredClone(base);
    mutate(broken);
    assert.throws(() => parseDatabase(broken));
  }
  assert.deepEqual(parseDatabase(JSON.parse(JSON.stringify(base))), base);
});

test("v1 snapshots preserve historical logs and progress, add personal bases and milestone-zero join history, and round-trip as v2", () => {
  const db = createSeed();
  const legacy = JSON.parse(JSON.stringify(db));
  legacy.version = 1;
  delete legacy.milestones;
  delete legacy.rewards;
  legacy.connections = legacy.connections
    .filter((b: { personalOwnerId: string | null }) => !b.personalOwnerId)
    .map(({ id, name }: { id: string; name: string }) => ({ id, name }));
  legacy.memberships = legacy.memberships.filter(
    (m: { connectionId: string }) => !m.connectionId.startsWith("personal_"),
  );
  legacy.logs = legacy.logs
    .filter(
      (l: { milestoneId: string }) =>
        db.milestones.find((m) => m.id === l.milestoneId)!.kind !== "join",
    )
    .map((l: Record<string, unknown>) => {
      delete l.milestoneId;
      delete l.isSuccess;
      return l;
    });
  const logIds = new Set(legacy.logs.map((l: { id: string }) => l.id));
  legacy.logShares = legacy.logShares.filter((s: { logId: string }) =>
    logIds.has(s.logId),
  );
  legacy.events = legacy.events.filter(
    (e: { entityType: string; entityId: string }) =>
      e.entityType === "subject" ||
      e.entityType === "activity" ||
      (e.entityType === "log" && logIds.has(e.entityId)),
  );
  const eventIds = new Set(legacy.events.map((e: { id: string }) => e.id));
  legacy.deliveries = legacy.deliveries.filter((d: { eventId: string }) =>
    eventIds.has(d.eventId),
  );
  const upgraded = parseDatabase(legacy);
  assert.equal(upgraded.version, 2);
  assert.deepEqual(upgraded.contributions, legacy.contributions);
  assert.deepEqual(upgraded.events, legacy.events);
  for (const id of logIds)
    assert.equal(upgraded.logs.find((l) => l.id === id)!.milestoneId, null);
  assert.equal(upgraded.milestones.length, upgraded.activities.length);
  assert.deepEqual(upgraded.rewards, []);
  assert.deepEqual(parseDatabase(upgraded), upgraded);
});

test("legacy demo identity changes preserve home-base ownership, reward rosters and authored records", () => {
  const current = createSeed();
  const legacy = JSON.parse(
    JSON.stringify(current)
      .replaceAll("rishik", "maya")
      .replaceAll("Rishik", "Maya"),
  );
  const upgraded = parseDatabase(legacy);
  assert.equal(upgraded.users.find((u) => u.id === "rishik")!.name, "Rishik");
  assert.ok(!JSON.stringify(upgraded).includes('"maya"'));
  assert.equal(upgraded.logs.length, current.logs.length);
  assert.ok(upgraded.connections.some((b) => b.personalOwnerId === "rishik"));
  assert.deepEqual(parseDatabase(upgraded), upgraded);
});

test("subject ownership and activity perspective remain independent of milestone logs", () => {
  const db = createSeed();
  assert.ok(
    !visibleActivities(db, "mosaab").some(
      (a) => a.name === "A quiet five minutes",
    ),
  );
  const subject = execute(
    db,
    {
      type: "createSubject",
      actorId: "rishik",
      templateId: "book",
      title: "Rishik's book",
      metadata: {},
    },
    now,
  );
  assert.ok(
    !visibleSubjects(subject.db, "mosaab").some(
      (s) => s.id === subject.entityId,
    ),
  );
  const activity = execute(
    subject.db,
    {
      type: "createActivity",
      actorId: "rishik",
      templateId: "read-book",
      name: "Read with me",
      description: "",
      connectionId: "mm",
      subjectIds: [subject.entityId],
      target: 8,
    },
    now,
  );
  assert.ok(
    visibleSubjects(activity.db, "mosaab").some(
      (s) => s.id === subject.entityId,
    ),
  );
  assert.equal(
    participation(activity.db, activity.entityId, "mosaab")!.status,
    "active",
  );
  assert.ok(parseDatabase(activity.db));
});

test("imports cannot replay achievements after leaving or append failures after success", () => {
  const initial = createSeed();
  const successful = record(initial).db;
  const failureAfterSuccess = structuredClone(successful);
  failureAfterSuccess.logs.push({
    ...failureAfterSuccess.logs.at(-1)!,
    id: "late-failure",
    isSuccess: false,
  });
  failureAfterSuccess.logShares.push({
    id: "late-failure-share",
    logId: "late-failure",
    connectionId: "mn",
    sharedByUserId: "mosaab",
  });
  assert.throws(() => parseDatabase(failureAfterSuccess), /Outcome follows/);
  const root = successful.milestones.find(
    (m) => m.activityId === book(successful).id && m.kind === "join",
  )!;
  const left = record(successful, {
    milestoneId: root.id,
    isSuccess: false,
  }).db;
  const achievement = left.logs.findIndex(
    (l) => l.milestoneId === chapter(left).id && l.authorUserId === "mosaab",
  );
  const [log] = left.logs.splice(achievement, 1);
  left.logs.push(log!);
  assert.throws(() => parseDatabase(left), /outside joined/);
});

test("users who left cannot plan or complete achievements; failed ordinary attempts are retryable until success", () => {
  const created = execute(
    createSeed(),
    {
      type: "createActivity",
      actorId: "mosaab",
      templateId: "workout",
      name: "Automatic start test",
      description: "",
      connectionId: "mn",
      subjectIds: [],
      target: 2,
    },
    now,
  );
  const planned = plan(created.db, {
    activityId: created.entityId,
    name: "First workout",
  });
  const root = planned.db.milestones.find(
    (m) => m.activityId === created.entityId && m.kind === "join",
  )!;
  const left = record(planned.db, {
    milestoneId: root.id,
    authorUserId: "nathaniel",
    isSuccess: false,
  }).db;
  assert.throws(
    () =>
      record(left, {
        milestoneId: planned.entityId,
        authorUserId: "nathaniel",
      }),
    /Join the activity/,
  );
  assert.throws(
    () => plan(left, { activityId: created.entityId, actorId: "nathaniel" }),
    /Join the activity/,
  );
  let db = record(left, {
    milestoneId: planned.entityId,
    isSuccess: false,
  }).db;
  db = record(db, { milestoneId: planned.entityId, isSuccess: false }).db;
  assert.equal(
    progress(db, participation(db, created.entityId, "mosaab")!).value,
    0,
  );
  db = record(db, { milestoneId: planned.entityId }).db;
  assert.equal(
    progress(db, participation(db, created.entityId, "mosaab")!).value,
    1,
  );
  assert.ok(parseDatabase(db));
});

test("automatic milestone zero covers personal and multi-member activities, including all members in shared rewards", () => {
  for (const connectionId of [null, "circle"] as const) {
    const before = createSeed();
    const result = execute(
      before,
      {
        type: "createActivity",
        actorId: "mosaab",
        templateId: "workout",
        name: "Automatic start",
        description: "",
        connectionId,
        subjectIds: [],
        target: 3,
      },
      now,
    );
    const people = result.db.participations.filter(
      (p) => p.activityId === result.entityId,
    );
    const root = result.db.milestones.find(
      (m) => m.activityId === result.entityId,
    )!;
    assert.equal(people.length, connectionId ? 3 : 1);
    assert.ok(people.every((p) => p.status === "active"));
    assert.equal(result.db.logs.length - before.logs.length, people.length);
    assert.ok(
      people.every((p) => completedMilestone(result.db, root.id, p.userId)),
    );
    assert.equal(result.db.contributions.length, before.contributions.length);
    assert.equal(result.db.rewards.length, before.rewards.length);
    const milestone = plan(result.db, {
      activityId: result.entityId,
      itemId: "sunflower",
    });
    assert.deepEqual(
      milestone.db.rewards.at(-1)!.requiredUserIds.sort(),
      people.map((p) => p.userId).sort(),
    );
    assert.ok(parseDatabase(milestone.db));
  }
});

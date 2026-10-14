import { test } from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "./seed.ts";
import {
  compatible,
  execute,
  participation,
  progress,
  visibleActivities,
  visibleLogs,
  visibleSubjects,
} from "./model.ts";
import { parseDatabase } from "./validation.ts";
import type { Database, LogInput } from "./types.ts";

function reading(db: Database): LogInput {
  return {
    authorUserId: "mosaab",
    title: "Chapter 5, one evening",
    subjectId: db.subjects.find((s) => s.title === "Dune")!.id,
    category: "reading",
    quantity: 5,
    unit: "chapters",
    durationMinutes: 30,
    occurredAt: "2026-10-14T18:00:00.000Z",
    origin: "manual",
    activityIds: db.activities
      .filter((a) => a.category === "reading")
      .map((a) => a.id),
    connectionIds: [],
  };
}
test("one log advances two independent activities and delivers only to their audiences", () => {
  const before = createSeed();
  const input = reading(before);
  const { db, entityId } = execute(before, {
    type: "recordLog",
    actorId: "mosaab",
    input,
  });
  assert.equal(db.logs.length, before.logs.length + 1);
  assert.equal(db.contributions.filter((c) => c.logId === entityId).length, 2);
  assert.equal(db.logShares.filter((s) => s.logId === entityId).length, 2);
  const book = db.activities.find((a) => a.name === "Dune, together")!;
  const habit = db.activities.find(
    (a) => a.name === "A little reading, often",
  )!;
  assert.equal(progress(db, participation(db, book.id, "mosaab")!).value, 5);
  assert.equal(progress(db, participation(db, habit.id, "mosaab")!).value, 2);
  assert.equal(progress(db, participation(db, book.id, "nathaniel")!).value, 4);
  const event = db.events.findLast(
    (e) => e.type === "contribution.created" && e.entityId === book.id,
  )!;
  assert.deepEqual(
    db.deliveries
      .filter((d) => d.eventId === event.id)
      .map((d) => d.recipientUserId)
      .sort(),
    ["mosaab", "nathaniel"],
  );
  assert.ok(parseDatabase(db));
  assert.equal(before.logs.length, 3);
});
test("private logs stay private; sharing later adds visibility without automatic credit", () => {
  const initial = createSeed();
  const input = { ...reading(initial), activityIds: [], connectionIds: [] };
  const first = execute(initial, {
    type: "recordLog",
    actorId: "mosaab",
    input,
  });
  assert.ok(
    !visibleLogs(first.db, "maya").some((l) => l.id === first.entityId),
  );
  const second = execute(first.db, {
    type: "distributeLog",
    actorId: "mosaab",
    logId: first.entityId,
    activityIds: [],
    connectionIds: ["mm"],
  });
  assert.ok(
    visibleLogs(second.db, "maya").some((l) => l.id === first.entityId),
  );
  assert.equal(second.db.contributions.length, initial.contributions.length);
  const third = execute(second.db, {
    type: "distributeLog",
    actorId: "mosaab",
    logId: first.entityId,
    activityIds: reading(initial).activityIds,
    connectionIds: [],
  });
  const again = execute(third.db, {
    type: "distributeLog",
    actorId: "mosaab",
    logId: first.entityId,
    activityIds: reading(initial).activityIds,
    connectionIds: ["mm"],
  });
  assert.equal(again.db.contributions.length, third.db.contributions.length);
  assert.equal(again.db.events.length, third.db.events.length);
});
test("voice, MCP and automation use the same rules and retries are idempotent", () => {
  for (const origin of ["voice", "mcp", "automation"] as const) {
    const initial = createSeed();
    const input = { ...reading(initial), origin, externalKey: "same-request" };
    const first = execute(initial, {
      type: "recordLog",
      actorId: "mosaab",
      input,
    });
    const retry = execute(first.db, {
      type: "recordLog",
      actorId: "mosaab",
      input,
    });
    assert.equal(retry.duplicate, true);
    assert.equal(retry.entityId, first.entityId);
    assert.equal(retry.db.logs.length, first.db.logs.length);
  }
});
test("bad audience, author, subject, units or inactive participation reject the whole transaction", () => {
  const db = createSeed();
  const input = reading(db);
  const count = db.logs.length;
  assert.throws(() =>
    execute(db, {
      type: "recordLog",
      actorId: "mosaab",
      input: { ...input, connectionIds: ["nm"] },
    }),
  );
  assert.throws(() =>
    execute(db, { type: "recordLog", actorId: "maya", input }),
  );
  assert.throws(() =>
    execute(db, {
      type: "recordLog",
      actorId: "mosaab",
      input: { ...input, unit: "km" },
    }),
  );
  const otherBook = db.subjects.find((s) => s.title === "The Little Prince")!;
  assert.throws(() =>
    execute(db, {
      type: "recordLog",
      actorId: "mosaab",
      input: { ...input, subjectId: otherBook.id },
    }),
  );
  const book = db.activities.find((a) => a.name === "Dune, together")!;
  const left = execute(db, {
    type: "participate",
    actorId: "mosaab",
    activityId: book.id,
    status: "left",
  }).db;
  assert.equal(compatible(left, "mosaab", book, input), false);
  assert.throws(() =>
    execute(left, { type: "recordLog", actorId: "mosaab", input }),
  );
  assert.equal(db.logs.length, count);
});
test("position progress never adds repeated positions or regresses", () => {
  let db = createSeed();
  const book = db.activities.find((a) => a.name === "Dune, together")!;
  for (const quantity of [5, 3, 5])
    db = execute(db, {
      type: "recordLog",
      actorId: "mosaab",
      input: { ...reading(db), quantity, activityIds: [book.id] },
    }).db;
  assert.equal(progress(db, participation(db, book.id, "mosaab")!).value, 5);
});
test("invitations, personal ownership and shared subject links preserve perspective", () => {
  let db = createSeed();
  const subject = execute(db, {
    type: "createSubject",
    actorId: "maya",
    templateId: "book",
    title: "Maya's book",
    metadata: {},
  });
  db = subject.db;
  assert.ok(
    !visibleSubjects(db, "mosaab").some((s) => s.id === subject.entityId),
  );
  const activity = execute(db, {
    type: "createActivity",
    actorId: "maya",
    templateId: "read-book",
    name: "Read with me",
    description: "",
    connectionId: "mm",
    subjectIds: [subject.entityId],
    target: 8,
    inviteOthers: true,
  });
  db = activity.db;
  assert.equal(
    participation(db, activity.entityId, "mosaab")!.status,
    "invited",
  );
  assert.ok(
    visibleSubjects(db, "mosaab").some((s) => s.id === subject.entityId),
  );
  assert.ok(
    !visibleActivities(db, "nathaniel").some((a) => a.id === activity.entityId),
  );
  db = execute(db, {
    type: "participate",
    actorId: "mosaab",
    activityId: activity.entityId,
    status: "active",
    target: 4,
  }).db;
  assert.equal(participation(db, activity.entityId, "mosaab")!.target, 4);
  assert.ok(parseDatabase(db));
});
test("sum progress adds quantities, and completion affects only the selected person", () => {
  let db = createSeed();
  const a = db.activities.find((a) => a.name === "A little French")!;
  for (const quantity of [15, 20])
    db = execute(db, {
      type: "recordLog",
      actorId: "mosaab",
      input: {
        ...reading(db),
        subjectId: db.subjects.find((s) => s.title === "Conversational French")!
          .id,
        category: "learning",
        quantity,
        unit: "minutes",
        activityIds: [a.id],
      },
    }).db;
  assert.equal(progress(db, participation(db, a.id, "mosaab")!).value, 35);
  db = execute(db, {
    type: "participate",
    actorId: "mosaab",
    activityId: a.id,
    status: "finished",
  }).db;
  assert.equal(participation(db, a.id, "mosaab")!.status, "finished");
  assert.equal(progress(db, participation(db, a.id, "mosaab")!).value, 35);
});
test("restoring a database validates foreign keys, duplicate credit, ownership and amounts", () => {
  const db = createSeed();
  assert.deepEqual(parseDatabase(JSON.parse(JSON.stringify(db))), db);
  const badFk = structuredClone(db);
  badFk.logs[0]!.authorUserId = "unknown";
  assert.throws(() => parseDatabase(badFk));
  const duplicate = structuredClone(db);
  duplicate.contributions.push({
    ...duplicate.contributions[0]!,
    id: "duplicate",
  });
  assert.throws(() => parseDatabase(duplicate));
  const badOwner = structuredClone(db);
  badOwner.activities[0]!.personalOwnerId = "mosaab";
  assert.throws(() => parseDatabase(badOwner));
  const badAmount = structuredClone(db);
  badAmount.contributions[0]!.amount = 99;
  assert.throws(() => parseDatabase(badAmount));
});

test("request keys are normalized before deduplication and invalid trigger data is rejected", () => {
  const before = createSeed();
  const input = {
    ...reading(before),
    origin: "mcp" as const,
    externalKey: "  retry-key  ",
  };
  const first = execute(before, {
    type: "recordLog",
    actorId: "mosaab",
    input,
  });
  const second = execute(first.db, {
    type: "recordLog",
    actorId: "mosaab",
    input: { ...input, externalKey: "retry-key" },
  });
  assert.equal(second.duplicate, true);
  assert.ok(parseDatabase(second.db));
  assert.throws(() =>
    execute(before, {
      type: "recordLog",
      actorId: "mosaab",
      input: { ...input, quantity: NaN },
    }),
  );
  assert.throws(() =>
    execute(before, {
      type: "recordLog",
      actorId: "mosaab",
      input: { ...input, occurredAt: "yesterday" },
    }),
  );
});

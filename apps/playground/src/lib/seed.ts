import type { Database, LogInput } from "./types.ts";
import { activityTemplates, examples, subjectTemplates } from "./templates.ts";
import { execute } from "./model.ts";
import { rewardItems } from "./reward-items.ts";

export function createSeed(): Database {
  let db: Database = {
    version: 1,
    rewardItems: structuredClone(rewardItems),
    users: [
      {
        id: "mosaab",
        name: "Mosaab",
        email: "mosaab@example.test",
        color: "blue",
      },
      {
        id: "nathaniel",
        name: "Nathaniel",
        email: "nathaniel@example.test",
        color: "rose",
      },
      {
        id: "rishik",
        name: "Rishik",
        email: "rishik@example.test",
        color: "moss",
      },
    ],
    connections: [
      { id: "mn", name: "Mosaab + Nathaniel" },
      { id: "mm", name: "Reading rhythm" },
      { id: "circle", name: "The Sunday circle" },
      { id: "nm", name: "Nathaniel + Rishik" },
    ],
    memberships: [
      ["mn", "mosaab"],
      ["mn", "nathaniel"],
      ["mm", "mosaab"],
      ["mm", "rishik"],
      ["circle", "mosaab"],
      ["circle", "nathaniel"],
      ["circle", "rishik"],
      ["nm", "nathaniel"],
      ["nm", "rishik"],
    ].map(([connectionId, userId], i) => ({
      id: `member_${i}`,
      connectionId: connectionId!,
      userId: userId!,
    })),
    subjectTemplates: structuredClone(subjectTemplates),
    activityTemplates: structuredClone(activityTemplates),
    subjects: [],
    activities: [],
    activitySubjects: [],
    participations: [],
    logs: [],
    logShares: [],
    contributions: [],
    events: [],
    deliveries: [],
  };
  const subjectIds: string[] = [];
  for (const example of examples) {
    const result = execute(db, {
      type: "createSubject",
      actorId: "mosaab",
      ...example,
    });
    db = result.db;
    subjectIds.push(result.entityId);
  }
  const specs = [
    ["read-book", "Dune, together", "mn", [0], 22],
    ["reading-habit", "A little reading, often", "mm", [], 3],
    ["watch-series", "One more episode", "mn", [3], 9],
    ["workout", "Make room to move", "circle", [], 3],
    ["cook-recipe", "Nani's dal, two kitchens", "circle", [9], 1],
    ["language-practice", "A little French", null, [13], 60],
    ["journal-habit", "Three good things", null, [14], 5],
    ["custom-project", "Our photo zine", "circle", [16], 5],
  ] as const;
  const activityIds: string[] = [];
  for (const [
    templateId,
    name,
    connectionId,
    subjectIndexes,
    target,
  ] of specs) {
    const result = execute(db, {
      type: "createActivity",
      actorId: "mosaab",
      templateId,
      name,
      description: activityTemplates.find((t) => t.id === templateId)!
        .description,
      connectionId,
      subjectIds: subjectIndexes.map((i) => subjectIds[i]!),
      target,
      inviteOthers: false,
    });
    db = result.db;
    activityIds.push(result.entityId);
  }
  // A connection the initial user cannot access makes perspective boundaries testable.
  const privateActivity = execute(db, {
    type: "createActivity",
    actorId: "nathaniel",
    templateId: "mindful-habit",
    name: "A quiet five minutes",
    description: "A separate connection, visible to Nathaniel and Rishik.",
    connectionId: "nm",
    subjectIds: [],
    target: 3,
    inviteOthers: false,
  });
  db = privateActivity.db;
  const base: Omit<
    LogInput,
    "authorUserId" | "title" | "quantity" | "activityIds" | "connectionIds"
  > = {
    subjectId: subjectIds[0]!,
    category: "reading",
    unit: "chapters",
    durationMinutes: 30,
    occurredAt: "2026-10-12T18:00:00.000Z",
    origin: "manual",
  };
  db = execute(db, {
    type: "recordLog",
    actorId: "mosaab",
    input: {
      ...base,
      authorUserId: "mosaab",
      title: "Reached chapter 2",
      quantity: 2,
      activityIds: [activityIds[0]!, activityIds[1]!],
      connectionIds: [],
    },
  }).db;
  db = execute(db, {
    type: "recordLog",
    actorId: "nathaniel",
    input: {
      ...base,
      authorUserId: "nathaniel",
      title: "Reached chapter 4",
      quantity: 4,
      activityIds: [activityIds[0]!],
      connectionIds: [],
    },
  }).db;
  db = execute(db, {
    type: "recordLog",
    actorId: "rishik",
    input: {
      ...base,
      subjectId: null,
      authorUserId: "rishik",
      title: "An evening with a book",
      quantity: 20,
      unit: "minutes",
      activityIds: [activityIds[1]!],
      connectionIds: [],
    },
  }).db;
  const p = db.participations.find(
    (p) => p.activityId === activityIds[3] && p.userId === "nathaniel",
  );
  if (p) p.target = 4;
  // Static seed timestamps make import, reset, and snapshots repeatable.
  for (const table of [db.subjects, db.activities, db.logs, db.events])
    for (const record of table) record.createdAt = "2026-10-12T18:00:00.000Z";
  return db;
}

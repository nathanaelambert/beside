import type { Database } from "./types.ts";
import { activityTemplates, examples, subjectTemplates } from "./templates.ts";
import { execute } from "./model.ts";
import { rewardItems } from "@beside/rewards";

export function createSeed(): Database {
  let db: Database = {
    version: 2,
    rewardItems: structuredClone(rewardItems),
    milestones: [],
    rewards: [],
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
      { id: "mn", personalOwnerId: null, name: "Mosaab + Nathaniel" },
      { id: "mm", personalOwnerId: null, name: "Reading rhythm" },
      { id: "circle", personalOwnerId: null, name: "The Sunday circle" },
      { id: "nm", personalOwnerId: null, name: "Nathaniel + Rishik" },
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
  for (const user of db.users) {
    db.connections.push({
      id: `personal_${user.id}`,
      name: `${user.name}'s home base`,
      personalOwnerId: user.id,
    });
    db.memberships.push({
      id: `personal_member_${user.id}`,
      connectionId: `personal_${user.id}`,
      userId: user.id,
    });
  }
  const seedTime = "2026-10-12T18:00:00.000Z";
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
    const result = execute(
      db,
      {
        type: "createActivity",
        actorId: "mosaab",
        templateId,
        name,
        description: activityTemplates.find((t) => t.id === templateId)!
          .description,
        connectionId,
        subjectIds: subjectIndexes.map((i) => subjectIds[i]!),
        target,
      },
      seedTime,
    );
    db = result.db;
    activityIds.push(result.entityId);
  }
  // A connection the initial user cannot access makes perspective boundaries testable.
  const privateActivity = execute(
    db,
    {
      type: "createActivity",
      actorId: "nathaniel",
      templateId: "mindful-habit",
      name: "A quiet five minutes",
      description: "A separate connection, visible to Nathaniel and Rishik.",
      connectionId: "nm",
      subjectIds: [],
      target: 3,
    },
    seedTime,
  );
  db = privateActivity.db;
  for (const activity of db.activities) {
    const count =
      activity.progressMode === "position"
        ? Math.min(
            30,
            Math.ceil(
              db.participations.find((p) => p.activityId === activity.id)!
                .target,
            ),
          )
        : 3;
    for (let index = 1; index <= count; index++) {
      const name =
        activity.category === "reading" && activity.progressMode === "position"
          ? `Chapter ${index}`
          : activity.category === "watching"
            ? `Episode ${index}`
            : activity.category === "movement"
              ? `Workout day ${index}`
              : `Step ${index}`;
      db = execute(
        db,
        {
          type: "createMilestone",
          actorId: activity.creatorUserId,
          activityId: activity.id,
          parentId: null,
          name,
          quantity:
            activity.progressMode === "position"
              ? index
              : activity.progressMode === "sum"
                ? 20
                : 1,
          policy: "open",
          startAt: null,
          endAt: null,
          itemId: index === 1 ? "oak-tree" : null,
        },
        seedTime,
      ).db;
    }
  }
  const achievements = [
    ["mosaab", activityIds[0]!, "Chapter 2"],
    ["nathaniel", activityIds[0]!, "Chapter 4"],
    ["rishik", activityIds[1]!, "Step 1"],
  ];
  for (const [userId, activityId, name] of achievements) {
    const milestone = db.milestones.find(
      (m) => m.activityId === activityId && m.name === name,
    )!;
    db = execute(
      db,
      {
        type: "recordLog",
        actorId: userId!,
        input: {
          authorUserId: userId!,
          milestoneId: milestone.id,
          isSuccess: true,
          title: `Completed ${name}`,
          durationMinutes: 30,
          occurredAt: seedTime,
          origin: "manual",
        },
      },
      seedTime,
    ).db;
  }
  const person = db.participations.find(
    (p) => p.activityId === activityIds[3] && p.userId === "nathaniel",
  );
  if (person) person.target = 4;
  for (const table of [
    db.subjects,
    db.activities,
    db.milestones,
    db.logs,
    db.events,
  ])
    for (const record of table) record.createdAt = seedTime;
  return db;
}

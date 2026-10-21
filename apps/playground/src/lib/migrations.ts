import type { Database } from "./types.ts";

// Preserve existing experiments when upgrading the third seeded identity.
// Connection IDs and user-authored subject/log titles are deliberately stable.
export function migrateDemoIdentity(database: Database): Database {
  const legacy = database.users.find(
    (user) =>
      user.id === "maya" &&
      user.name === "Maya" &&
      user.email === "maya@example.test",
  );
  if (!legacy) return database;
  if (database.users.some((user) => user.id === "rishik"))
    throw new Error(
      "Cannot rename the legacy demo identity: the Rishik ID already exists. Export the experiment to resolve the collision.",
    );
  const db = structuredClone(database);
  const user = db.users.find((user) => user.id === legacy.id)!;
  user.id = "rishik";
  user.name = "Rishik";
  user.email = "rishik@example.test";
  const rename = (value: string | null) =>
    value === legacy.id ? user.id : value;
  for (const row of db.memberships) row.userId = rename(row.userId)!;
  for (const row of db.subjects) row.ownerUserId = rename(row.ownerUserId)!;
  for (const row of db.activities) {
    row.creatorUserId = rename(row.creatorUserId)!;
    row.personalOwnerId = rename(row.personalOwnerId);
    if (
      row.description ===
      "A separate connection, visible to Nathaniel and Maya."
    )
      row.description =
        "A separate connection, visible to Nathaniel and Rishik.";
  }
  for (const row of db.participations) row.userId = rename(row.userId)!;
  for (const row of db.logs) row.authorUserId = rename(row.authorUserId)!;
  for (const row of db.logShares)
    row.sharedByUserId = rename(row.sharedByUserId)!;
  for (const row of db.events) {
    row.actorUserId = rename(row.actorUserId)!;
    row.message = row.message.replace(/\bMaya\b/g, "Rishik");
  }
  for (const row of db.deliveries)
    row.recipientUserId = rename(row.recipientUserId)!;
  for (const reward of db.rewards)
    reward.requiredUserIds = reward.requiredUserIds.map((userId) =>
      rename(userId)!,
    );
  for (const connection of db.connections) {
    connection.personalOwnerId = rename(connection.personalOwnerId);
    if (connection.name === "Nathaniel + Maya")
      connection.name = "Nathaniel + Rishik";
  }
  return db;
}

// Upgrade only explicit v1 snapshots. Existing logs and progress are historical;
// they are never guessed into chapters or awarded retroactive rewards.
export function migrateMilestones(input: unknown): unknown {
  if (
    !input ||
    typeof input !== "object" ||
    !("version" in input) ||
    input.version !== 1
  )
    return input;
  const db = structuredClone(input) as Record<string, unknown>;
  if (
    ![
      "users",
      "connections",
      "memberships",
      "activities",
      "participations",
      "logs",
      "logShares",
    ].every((key) => Array.isArray(db[key]))
  )
    return input;
  // Structural validation still runs after this migration.
  const old = db as unknown as Database;
  old.version = 2;
  old.milestones = [];
  old.rewards = [];
  for (const base of old.connections) base.personalOwnerId = null;
  for (const user of old.users) {
    const baseId = `personal_${user.id}`;
    if (old.connections.some((base) => base.id === baseId))
      throw new Error(
        "Legacy home base ID collides with a personal home base.",
      );
    old.connections.push({
      id: baseId,
      name: `${user.name}'s home base`,
      personalOwnerId: user.id,
    });
    old.memberships.push({
      id: `personal_member_${user.id}`,
      connectionId: baseId,
      userId: user.id,
    });
  }
  for (const log of old.logs) {
    log.milestoneId = null;
    log.isSuccess = true;
  }
  for (const activity of old.activities) {
    const rootId = `join_${activity.id}`;
    old.milestones.push({
      id: rootId,
      activityId: activity.id,
      parentId: rootId,
      kind: "join",
      name: "Join activity",
      quantity: 1,
      policy: "open",
      startAt: null,
      endAt: null,
      rewardId: null,
      createdAt: activity.createdAt,
    });
    for (const person of old.participations.filter(
      (p) => p.activityId === activity.id && p.status !== "invited",
    )) {
      const logId = `join_log_${person.id}`;
      old.logs.push({
        id: logId,
        milestoneId: rootId,
        isSuccess: true,
        authorUserId: person.userId,
        subjectId: null,
        category: activity.category,
        title: "Joined activity (preserved participation)",
        quantity: 1,
        unit: activity.unit,
        durationMinutes: 0,
        occurredAt: activity.createdAt,
        origin: "manual",
        externalKey: null,
        createdAt: activity.createdAt,
      });
      if (activity.connectionId)
        old.logShares.push({
          id: `join_share_${person.id}`,
          logId,
          connectionId: activity.connectionId,
          sharedByUserId: person.userId,
        });
      if (person.status === "left") {
        const leaveId = `leave_log_${person.id}`;
        old.logs.push({
          ...old.logs[old.logs.length - 1]!,
          id: leaveId,
          isSuccess: false,
          title: "Left activity (preserved participation)",
        });
        if (activity.connectionId)
          old.logShares.push({
            id: `leave_share_${person.id}`,
            logId: leaveId,
            connectionId: activity.connectionId,
            sharedByUserId: person.userId,
          });
      }
    }
  }
  return old;
}

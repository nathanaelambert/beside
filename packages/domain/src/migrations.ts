import type { Activity, Database, Homebase } from "./types.ts";

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
    if (row.entityType === "user") row.entityId = rename(row.entityId)!;
    row.message = row.message.replace(/\bMaya\b/g, "Rishik");
  }
  for (const row of db.deliveries)
    row.recipientUserId = rename(row.recipientUserId)!;
  for (const reward of db.rewards)
    reward.requiredUserIds = reward.requiredUserIds.map((userId) =>
      rename(userId)!,
    );
  for (const connection of db.connections) {
    if (connection.name === "Maya's home base")
      connection.name = "Rishik's home base";
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
  const old = db as unknown as LegacyDatabaseV2;
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

// Kept only at the import boundary so existing v1/v2 experiments retain IDs,
// progress, rewards and history when their former personal base becomes ordinary.
type LegacyDatabaseV2 = Omit<
  Database,
  "version" | "connections" | "activities"
> & {
  version: 2;
  connections: (Homebase & { personalOwnerId: string | null })[];
  activities: (Omit<Activity, "connectionId"> & {
    connectionId: string | null;
    personalOwnerId: string | null;
  })[];
};

export function migrateHomebases(input: unknown): unknown {
  if (
    !input ||
    typeof input !== "object" ||
    !("version" in input) ||
    input.version !== 2
  )
    return input;
  const source = input as Record<string, unknown>;
  if (
    ![
      "users",
      "connections",
      "memberships",
      "activities",
      "milestones",
      "logs",
      "logShares",
      "contributions",
      "participations",
    ].every((key) => Array.isArray(source[key]))
  )
    return input;
  const old = structuredClone(input) as LegacyDatabaseV2;
  const personalBases = new Map<string, string>();
  for (const base of old.connections) {
    if (base.personalOwnerId === null) continue;
    const owner = base.personalOwnerId;
    const memberships = old.memberships.filter(
      (member) => member.connectionId === base.id,
    );
    if (
      !owner ||
      !old.users.some((user) => user.id === owner) ||
      personalBases.has(owner) ||
      memberships.length !== 1 ||
      memberships[0]!.userId !== owner
    )
      throw new Error("Invalid legacy personal home base.");
    personalBases.set(owner, base.id);
  }
  for (const user of old.users)
    if (!personalBases.has(user.id))
      throw new Error("Legacy user is missing a home base.");
  const migratedActivities = new Map<string, string>();
  const activities = old.activities.map(({ personalOwnerId, ...activity }) => {
    if ((personalOwnerId === null) === (activity.connectionId === null))
      throw new Error("Invalid legacy activity scope.");
    if (personalOwnerId && activity.creatorUserId !== personalOwnerId)
      throw new Error("Invalid legacy activity owner.");
    const connectionId =
      activity.connectionId ?? personalBases.get(personalOwnerId!);
    if (!connectionId)
      throw new Error("Legacy activity is missing its home base.");
    if (personalOwnerId) migratedActivities.set(activity.id, connectionId);
    return { ...activity, connectionId };
  });
  // Previously private milestone logs now have the same base audience as all
  // other activity logs. Existing shares, contributions and events stay intact.
  for (const log of old.logs) {
    const activityIds = new Set([
      ...old.milestones
        .filter((milestone) => milestone.id === log.milestoneId)
        .map((milestone) => milestone.activityId),
      ...old.contributions
        .filter((credit) => credit.logId === log.id)
        .flatMap((credit) =>
          old.participations
            .filter((person) => person.id === credit.participationId)
            .map((person) => person.activityId),
        ),
    ]);
    for (const activityId of activityIds) {
      const connectionId = migratedActivities.get(activityId);
      if (
        connectionId &&
        !old.logShares.some(
          (share) =>
            share.logId === log.id && share.connectionId === connectionId,
        )
      )
        old.logShares.push({
          id: `share_${crypto.randomUUID()}`,
          logId: log.id,
          connectionId,
          sharedByUserId: log.authorUserId,
        });
    }
  }
  return {
    ...old,
    version: 3,
    activities,
    connections: old.connections.map(
      ({ personalOwnerId: _owner, ...base }) => base,
    ),
  };
}

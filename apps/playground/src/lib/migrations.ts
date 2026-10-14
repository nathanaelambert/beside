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
  for (const connection of db.connections)
    if (connection.name === "Nathaniel + Maya")
      connection.name = "Nathaniel + Rishik";
  return db;
}

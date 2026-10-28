import { Pool, types, type PoolClient } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import type { Database } from "@beside/domain/types";
import { rewardItems } from "@beside/domain/catalog";
import { activityTemplates, subjectTemplates } from "@beside/domain/templates";
import { sqlName, tables } from "./tables.ts";

types.setTypeParser(1700, Number);
export function createPool(connectionString: string) {
  const url = new URL(connectionString);
  if (
    ["prefer", "require", "verify-ca"].includes(
      url.searchParams.get("sslmode") ?? "",
    )
  ) {
    url.searchParams.set("sslmode", "verify-full");
  }
  const pool = new Pool({
    connectionString: url.toString(),
    max: 5,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
  });
  // Report the event without logging connection strings or SQL parameters.
  pool.on("error", () => console.error("PostgreSQL idle connection error"));
  if (process.env.VERCEL) attachDatabasePool(pool);
  return pool;
}
export function emptyDatabase(): Database {
  return {
    version: 3,
    rewardItems: structuredClone(rewardItems),
    activityTemplates: structuredClone(activityTemplates),
    subjectTemplates: structuredClone(subjectTemplates),
    users: [],
    connections: [],
    memberships: [],
    subjects: [],
    activities: [],
    activitySubjects: [],
    participations: [],
    rewards: [],
    milestones: [],
    logs: [],
    logShares: [],
    contributions: [],
    events: [],
    deliveries: [],
  };
}
export async function loadDatabase(client: PoolClient): Promise<Database> {
  const db = { version: 3 } as Database;
  for (const [key, table, columns] of tables) {
    const result = await client.query(
      `SELECT ${columns.map(sqlName).join(", ")} FROM ${table} ORDER BY row_order`,
    );
    const records = result.rows.map((row: Record<string, unknown>) =>
      Object.fromEntries(
        columns.map((column) => {
          const value = row[sqlName(column)];
          return [column, value instanceof Date ? value.toISOString() : value];
        }),
      ),
    );
    Object.assign(db, { [key]: records });
  }
  return db;
}
export async function persistChanges(
  client: PoolClient,
  before: Database,
  after: Database,
) {
  for (const [key, table, columns] of tables) {
    const previous = new Map(
      before[key].map((record) => [record.id, JSON.stringify(record)]),
    );
    for (const record of after[key]) {
      if (previous.get(record.id) === JSON.stringify(record)) continue;
      const values = columns.map((column) => {
        const value = (record as unknown as Record<string, unknown>)[column];
        return value !== null && typeof value === "object"
          ? JSON.stringify(value)
          : value;
      });
      await client.query(
        `INSERT INTO ${table} (${columns.map(sqlName).join(", ")}) VALUES (${values.map((_, index) => `$${index + 1}`).join(", ")}) ON CONFLICT (id) DO UPDATE SET ${columns
          .slice(1)
          .map((column) => `${sqlName(column)} = EXCLUDED.${sqlName(column)}`)
          .join(", ")}`,
        values,
      );
    }
  }
}

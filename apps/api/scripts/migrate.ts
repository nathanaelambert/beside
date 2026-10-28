import { readFile, readdir } from "node:fs/promises";
import {
  createPool,
  emptyDatabase,
  persistChanges,
} from "../src/db/storage.ts";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url)
  throw new Error(
    "Set DATABASE_URL or DATABASE_URL_UNPOOLED before running migrations.",
  );
const pool = createPool(url);
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(724390821)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS beside_migration (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const directory = new URL("../src/db/migrations/", import.meta.url);
  const migrations = (await readdir(directory))
    .filter((name) => /^\d+_.*\.sql$/.test(name))
    .sort();
  let initialized = false;
  for (const name of migrations) {
    const result = await client.query(
      "SELECT 1 FROM beside_migration WHERE name = $1",
      [name],
    );
    if (result.rowCount) {
      console.log(`${name} already applied.`);
      continue;
    }
    await client.query(await readFile(new URL(name, directory), "utf8"));
    await client.query("INSERT INTO beside_migration(name) VALUES ($1)", [
      name,
    ]);
    if (name === "001_initial.sql") initialized = true;
    console.log(`Applied ${name}.`);
  }
  // Seed a fresh database after every migration, using the current shape.
  if (initialized) {
    const seeded = emptyDatabase();
    const blank = emptyDatabase();
    blank.rewardItems = [];
    blank.subjectTemplates = [];
    blank.activityTemplates = [];
    await persistChanges(client, blank, seeded);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  // Do not print a driver error containing connection details.
  console.error(
    "Migration failed. Check database connectivity, permissions, and migration SQL.",
  );
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}

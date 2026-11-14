import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { it } from "node:test";
import { createSeed } from "@beside/domain/seed";
import { parseDatabase } from "@beside/domain/validation";
import { createPool, loadDatabase } from "../src/db/storage.ts";
import { sqlName, tables } from "../src/db/tables.ts";

it(
  "creates coordinate gardens with required grid positions and cascading homebase ownership",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = createPool(process.env.TEST_DATABASE_URL!);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "CREATE TEMP TABLE homebase (id text PRIMARY KEY) ON COMMIT DROP",
      );
      await client.query("SET LOCAL search_path TO pg_temp");
      // Temp parent and child must share the same table lifetime.
      const migration = await readFile(
        new URL(
          "../src/db/migrations/005_homebase_starter_oak.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await client.query(
        migration.replace("CREATE TABLE", "CREATE TEMP TABLE"),
      );
      await client.query(
        "INSERT INTO homebase VALUES ('west'), ('east'), ('new'), ('invalid')",
      );
      await client.query(
        "INSERT INTO homebase_starter_oak (homebase_id, x, y) VALUES ('west', 112, 104), ('east', 176, 104)",
      );
      await client.query(
        "INSERT INTO homebase_starter_oak (homebase_id, x, y) VALUES ('new', 104, 104)",
      );
      const { rows } = await client.query(
        "SELECT homebase_id, x, y FROM homebase_starter_oak ORDER BY homebase_id",
      );
      assert.deepEqual(rows, [
        { homebase_id: "east", x: 176, y: 104 },
        { homebase_id: "new", x: 104, y: 104 },
        { homebase_id: "west", x: 112, y: 104 },
      ]);
      const columns = await client.query(
        "SELECT attname FROM pg_attribute WHERE attrelid = 'homebase_starter_oak'::regclass AND attnum > 0 AND NOT attisdropped ORDER BY attnum",
      );
      assert.deepEqual(
        columns.rows.map((row) => row.attname),
        ["homebase_id", "x", "y"],
      );
      for (const [homebaseId, x, y, code] of [
        ["invalid", null, 104, "23502"],
        ["invalid", 104, null, "23502"],
        ["invalid", -8, 104, "23514"],
        ["invalid", 288, 104, "23514"],
        ["invalid", 104, 240, "23514"],
        ["invalid", 105, 104, "23514"],
        ["missing", 104, 104, "23503"],
        ["west", 104, 104, "23505"],
      ]) {
        await client.query("SAVEPOINT invalid_oak");
        await assert.rejects(
          client.query(
            "INSERT INTO homebase_starter_oak (homebase_id, x, y) VALUES ($1, $2, $3)",
            [homebaseId, x, y],
          ),
          { code },
        );
        await client.query("ROLLBACK TO SAVEPOINT invalid_oak");
      }
      await client.query("DELETE FROM homebase WHERE id = 'west'");
      const remaining = await client.query(
        "SELECT homebase_id FROM homebase_starter_oak ORDER BY homebase_id",
      );
      assert.deepEqual(remaining.rows, [
        { homebase_id: "east" },
        { homebase_id: "new" },
      ]);
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await pool.end();
    }
  },
);

it(
  "upgrades populated v2 PostgreSQL data without losing progress, rewards or existing invitation codes",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = createPool(process.env.TEST_DATABASE_URL!);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const schema = `migration_${crypto.randomUUID().replaceAll("-", "")}`;
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET LOCAL search_path TO "${schema}"`);
      await client.query(
        await readFile(
          new URL("../src/db/migrations/001_initial.sql", import.meta.url),
          "utf8",
        ),
      );
      const seed = createSeed();
      for (const [key, table, currentColumns] of tables) {
        const columns: string[] = [...currentColumns];
        if (key === "connections" || key === "activities")
          columns.push("personalOwnerId");
        for (const row of seed[key]) {
          const record = { ...row } as unknown as Record<string, unknown>;
          if (key === "connections")
            record.personalOwnerId = record
              .id!.toString()
              .startsWith("personal_")
              ? record.id!.toString().slice(9)
              : null;
          if (key === "activities") {
            const solo = record
              .connectionId!.toString()
              .startsWith("personal_");
            record.personalOwnerId = solo ? record.creatorUserId : null;
            if (solo) record.connectionId = null;
          }
          if (
            key === "logShares" &&
            record.connectionId!.toString().startsWith("personal_")
          )
            continue;
          const values = columns.map((column) => {
            const value = record[column];
            return value !== null && typeof value === "object"
              ? JSON.stringify(value)
              : value;
          });
          await client.query(
            `INSERT INTO ${table} (${columns.map(sqlName).join(", ")}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")})`,
            values,
          );
        }
      }
      await client.query(
        "INSERT INTO homebase_invite(homebase_id, code) VALUES ('mn', 'existing-invitation-code')",
      );
      await client.query(
        await readFile(
          new URL(
            "../src/db/migrations/002_uniform_homebases.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const upgraded = parseDatabase(await loadDatabase(client));
      for (const key of Object.keys(seed) as (keyof typeof seed)[]) {
        if (key !== "logShares")
          assert.deepEqual(upgraded[key], seed[key], `Preserve ${key}`);
      }
      assert.deepEqual(
        new Set(
          upgraded.logShares.map(
            (share) => `${share.logId}:${share.connectionId}`,
          ),
        ),
        new Set(
          seed.logShares.map((share) => `${share.logId}:${share.connectionId}`),
        ),
      );
      const { rows } = await client.query(
        "SELECT homebase_id, code FROM homebase_invite",
      );
      assert.equal(rows.length, seed.connections.length);
      assert.equal(
        rows.find((row) => row.homebase_id === "mn").code,
        "existing-invitation-code",
      );
      assert.ok(rows.every((row) => row.code.length >= 20));
      const columns = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND column_name = 'personal_owner_id'",
        [schema],
      );
      assert.equal(columns.rowCount, 0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await pool.end();
    }
  },
);

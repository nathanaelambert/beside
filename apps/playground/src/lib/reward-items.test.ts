import { test } from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "./seed.ts";
import { parseDatabase } from "./validation.ts";

test("the catalog contains twelve distinct, valid sprites across five categories", () => {
  const db = parseDatabase(createSeed());
  assert.equal(db.rewardItems.length, 12);
  for (const [category, count] of [
    ["Trees", 3],
    ["Flowers", 3],
    ["Statues", 3],
    ["Flagpoles", 2],
    ["Furniture", 1],
  ] as const)
    assert.equal(
      db.rewardItems.filter((item) => item.category === category).length,
      count,
    );
  assert.equal(
    new Set(db.rewardItems.map((item) => JSON.stringify(item.artifact.pixels)))
      .size,
    12,
  );
  for (const item of db.rewardItems) {
    assert.equal(item.artifact.pixels.length, 32);
    assert.ok(item.artifact.pixels.every((row) => row.length === 32));
    assert.ok(item.artifact.pixels.join("").includes("."));
  }
});

test("legacy experiments acquire the catalog without losing records, then round-trip unchanged", () => {
  const db = createSeed();
  const { rewardItems: omitted, ...legacy } = db;
  const migrated = parseDatabase(legacy);
  assert.equal(migrated.rewardItems.length, omitted.length);
  for (const [key, value] of Object.entries(legacy))
    assert.deepEqual(migrated[key as keyof typeof legacy], value);
  assert.deepEqual(
    parseDatabase(JSON.parse(JSON.stringify(migrated))),
    migrated,
  );
  assert.equal(Object.hasOwn(legacy, "rewardItems"), false);
  migrated.rewardItems[0]!.name = "A renamed oak";
  migrated.rewardItems[0]!.category = "Keepsakes";
  assert.deepEqual(parseDatabase(migrated), migrated);
  const empty = {
    ...migrated,
    rewardItems: [],
    rewards: [],
    milestones: migrated.milestones.map((m) => ({ ...m, rewardId: null })),
  };
  assert.deepEqual(parseDatabase(empty), empty);
  assert.notEqual(createSeed().rewardItems[0]!.name, "A renamed oak");
});

test("import rejects duplicate reward IDs, malformed grids, missing colors, and markup", () => {
  const invalid = [
    (db: ReturnType<typeof createSeed>) =>
      db.rewardItems.push(structuredClone(db.rewardItems[0]!)),
    (db: ReturnType<typeof createSeed>) => {
      db.rewardItems[0]!.artifact.pixels[0] = ".";
    },
    (db: ReturnType<typeof createSeed>) => {
      db.rewardItems[0]!.artifact.palette = {};
    },
    (db: ReturnType<typeof createSeed>) => {
      db.rewardItems[0]!.artifact.palette.a = '"/><script>alert(1)</script>';
    },
    (db: ReturnType<typeof createSeed>) => {
      db.rewardItems[0]!.artifact.pixels = ["a".repeat(65)];
    },
    (db: ReturnType<typeof createSeed>) => {
      db.rewardItems[0]!.artifact.pixels = ["...."];
    },
    (db: ReturnType<typeof createSeed>) => {
      db.rewardItems[0]!.name = " ";
    },
  ];
  for (const mutate of invalid) {
    const db = createSeed();
    mutate(db);
    assert.throws(() => parseDatabase(db));
  }
});

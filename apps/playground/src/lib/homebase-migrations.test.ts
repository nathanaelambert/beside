import assert from "node:assert/strict";
import { test } from "node:test";
import { createSeed } from "./seed.ts";
import { parseDatabase } from "./validation.ts";

function legacySnapshot() {
  const current = createSeed();
  return {
    ...current,
    version: 2,
    connections: current.connections.map((base) => ({
      ...base,
      personalOwnerId: base.id.startsWith("personal_")
        ? base.id.slice(9)
        : null,
    })),
    activities: current.activities.map((activity) => ({
      ...activity,
      personalOwnerId: activity.connectionId.startsWith("personal_")
        ? activity.creatorUserId
        : null,
      connectionId: activity.connectionId.startsWith("personal_")
        ? null
        : activity.connectionId,
    })),
    logShares: current.logShares.filter(
      (share) => !share.connectionId.startsWith("personal_"),
    ),
  };
}

test("v2 home bases become uniform while preserving memberships, progress, rewards and history", () => {
  const legacy = legacySnapshot();
  const unchanged = structuredClone(legacy);
  const upgraded = parseDatabase(legacy);
  assert.deepEqual(legacy, unchanged);
  assert.equal(upgraded.version, 3);
  assert.ok(upgraded.connections.every((base) => !("personalOwnerId" in base)));
  assert.ok(
    upgraded.activities.every(
      (activity) => !("personalOwnerId" in activity) && activity.connectionId,
    ),
  );
  for (const key of [
    "memberships",
    "participations",
    "logs",
    "contributions",
    "rewards",
    "events",
    "deliveries",
  ] as const)
    assert.deepEqual(upgraded[key], legacy[key]);
  for (const activity of upgraded.activities) {
    for (const log of upgraded.logs.filter(
      (log) =>
        upgraded.milestones.find(
          (milestone) => milestone.id === log.milestoneId,
        )?.activityId === activity.id,
    )) {
      assert.ok(
        upgraded.logShares.some(
          (share) =>
            share.logId === log.id &&
            share.connectionId === activity.connectionId,
        ),
      );
    }
  }
  assert.deepEqual(parseDatabase(upgraded), upgraded);
});

test("v2 migration rejects an ambiguous former personal home base", () => {
  const legacy = legacySnapshot();
  legacy.memberships.push({
    id: "invalid-member",
    connectionId: "personal_mosaab",
    userId: "nathaniel",
  });
  assert.throws(
    () => parseDatabase(legacy),
    /Invalid legacy personal home base/,
  );
});

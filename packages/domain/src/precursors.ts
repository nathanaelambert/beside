import { buildPlans, precursorChain, precursorOf } from "@beside/rewards";
import type { Database, GardenObject, Reward } from "./types.ts";

export { buildPlans, precursorChain, precursorOf } from "@beside/rewards";

// Fixed lawn plots for earned objects, nearest the picnic first. Each is a
// bottom-centre anchor on the 8 px meadow grid, clear of the scenery, pond,
// paths and the four-person picnic. The mobile scene test checks the art.
export const gardenPlots: readonly { x: number; y: number }[] = [
  { x: 168, y: 120 },
  { x: 112, y: 104 },
  { x: 136, y: 80 },
  { x: 80, y: 120 },
  { x: 168, y: 96 },
  { x: 48, y: 112 },
  { x: 144, y: 56 },
  { x: 208, y: 72 },
  { x: 72, y: 64 },
  { x: 40, y: 168 },
  { x: 160, y: 216 },
  { x: 112, y: 40 },
];

type Garden = Pick<
  Database,
  "rewards" | "gardenObjects" | "milestones" | "rewardItems"
>;

// An unobtained reward still counts while its milestone can be completed. A
// closed, unearned window can never grant it, so it stops reserving anything.
export function liveReward(
  db: Pick<Database, "milestones">,
  reward: Reward,
  now: string,
) {
  if (reward.obtainedAt) return true;
  const milestone = db.milestones.find((m) => m.rewardId === reward.id);
  if (!milestone) return false;
  return (
    milestone.policy === "open" ||
    !milestone.endAt ||
    Date.parse(milestone.endAt) >= Date.parse(now)
  );
}

const byAge = (a: GardenObject, b: GardenObject) =>
  Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id);

// Supply and demand for one precursor stage in a home base. Rewards are
// "pending" until they are applied to a garden object.
export function precursorSupply(
  db: Garden,
  homebaseId: string,
  precursorId: string,
  now: string,
  ignoreRewardId?: string,
) {
  const objects = db.gardenObjects
    .filter((o) => o.homebaseId === homebaseId && o.itemId === precursorId)
    .sort(byAge);
  const pending = db.rewards.filter(
    (r) =>
      r.homebaseId === homebaseId &&
      r.id !== ignoreRewardId &&
      !r.gardenObjectId &&
      liveReward(db, r, now),
  );
  const promised = pending.filter((r) => r.itemId === precursorId).length;
  const claimed = pending.filter(
    (r) => precursorOf(r.itemId) === precursorId,
  ).length;
  return {
    objects,
    promised,
    claimed,
    free: objects.length + promised - claimed,
  };
}

export type RewardStatus =
  // No precursor: it gets its own plot.
  | { kind: "place" }
  // The precursor stands in the garden and nobody has claimed it yet.
  | { kind: "ready"; precursorId: string; target: GardenObject }
  // The precursor is planned or earned but not built yet. Plannable; it is
  // applied automatically once the precursor exists.
  | { kind: "queued"; precursorId: string }
  // Nothing to build on. Plan or earn the precursor first.
  | { kind: "locked"; precursorId: string; chain: string[] };

export function rewardStatus(
  db: Garden,
  homebaseId: string,
  itemId: string,
  now: string,
  ignoreRewardId?: string,
): RewardStatus {
  const precursorId = precursorOf(itemId);
  if (!precursorId) return { kind: "place" };
  const supply = precursorSupply(
    db,
    homebaseId,
    precursorId,
    now,
    ignoreRewardId,
  );
  if (supply.free <= 0)
    return { kind: "locked", precursorId, chain: precursorChain(itemId) };
  // Pending upgrades take the oldest objects first, matching settleGarden.
  const target = supply.objects[supply.claimed];
  return target
    ? { kind: "ready", precursorId, target }
    : { kind: "queued", precursorId };
}

export const itemName = (db: Pick<Database, "rewardItems">, itemId: string) =>
  db.rewardItems.find((item) => item.id === itemId)?.name ?? itemId;

export function lockedMessage(
  db: Pick<Database, "rewardItems">,
  itemId: string,
  precursorId: string,
) {
  return `${itemName(db, itemId)} needs a ${itemName(db, precursorId)} in your garden first. Plan or earn one, then try again.`;
}

export function nextFreePlot(
  db: Pick<Database, "gardenObjects">,
  homebaseId: string,
) {
  return gardenPlots.find(
    (plot) =>
      !db.gardenObjects.some(
        (o) => o.homebaseId === homebaseId && o.x === plot.x && o.y === plot.y,
      ),
  );
}

export interface GardenChange {
  kind: "placed" | "upgraded";
  reward: Reward;
  object: GardenObject;
  fromItemId: string | null;
}

// Apply every obtained-but-unapplied reward, oldest first, until nothing more
// can change. A roof earned before its walls waits, then lands with them.
export function settleGarden(
  db: Database,
  homebaseId: string,
  now: string,
): GardenChange[] {
  const changes: GardenChange[] = [];
  for (let changed = true; changed;) {
    changed = false;
    const waiting = db.rewards
      .filter(
        (r) => r.homebaseId === homebaseId && r.obtainedAt && !r.gardenObjectId,
      )
      .sort(
        (a, b) =>
          Date.parse(a.obtainedAt!) - Date.parse(b.obtainedAt!) ||
          a.id.localeCompare(b.id),
      );
    for (const reward of waiting) {
      const precursorId = precursorOf(reward.itemId);
      if (!precursorId) {
        const plot = nextFreePlot(db, homebaseId);
        const object: GardenObject = {
          id: `garden_${crypto.randomUUID()}`,
          homebaseId,
          itemId: reward.itemId,
          x: plot?.x ?? null,
          y: plot?.y ?? null,
          createdAt: now,
          updatedAt: now,
        };
        db.gardenObjects.push(object);
        reward.gardenObjectId = object.id;
        changes.push({ kind: "placed", reward, object, fromItemId: null });
        changed = true;
        continue;
      }
      const target = db.gardenObjects
        .filter((o) => o.homebaseId === homebaseId && o.itemId === precursorId)
        .sort(byAge)[0];
      if (!target) continue;
      changes.push({
        kind: "upgraded",
        reward,
        object: target,
        fromItemId: target.itemId,
      });
      target.itemId = reward.itemId;
      target.updatedAt = now;
      reward.gardenObjectId = target.id;
      changed = true;
    }
  }
  return changes;
}

// Rewards that placed or upgraded an object, in build order. A stage earned
// early (walls before the foundation) still lists after the stage below it.
export function gardenHistory(
  db: Pick<Database, "rewards">,
  object: Pick<GardenObject, "id" | "itemId">,
) {
  const stages = [...precursorChain(object.itemId).reverse(), object.itemId];
  return db.rewards
    .filter((r) => r.gardenObjectId === object.id && r.obtainedAt)
    .sort(
      (a, b) =>
        stages.indexOf(a.itemId) - stages.indexOf(b.itemId) ||
        Date.parse(a.obtainedAt!) - Date.parse(b.obtainedAt!),
    );
}

// A catalog view for one home base: what is available, what each locked
// item needs, and how far each multi-stage build has come.
export function rewardCatalog(db: Garden, homebaseId: string, now: string) {
  const items = db.rewardItems.map((item) => {
    const status = rewardStatus(db, homebaseId, item.id, now);
    const inGarden = db.gardenObjects.filter(
      (o) => o.homebaseId === homebaseId && o.itemId === item.id,
    ).length;
    const planned = db.rewards.filter(
      (r) =>
        r.homebaseId === homebaseId &&
        r.itemId === item.id &&
        !r.obtainedAt &&
        liveReward(db, r, now),
    ).length;
    const waiting = db.rewards.filter(
      (r) =>
        r.homebaseId === homebaseId &&
        r.itemId === item.id &&
        r.obtainedAt &&
        !r.gardenObjectId,
    ).length;
    return { item, status, inGarden, planned, waiting };
  });
  const builds = buildPlans.map((plan) => {
    // The most advanced object of this build, by stage.
    const objects = db.gardenObjects.filter(
      (o) => o.homebaseId === homebaseId && plan.stages.includes(o.itemId),
    );
    const reached = Math.max(
      0,
      ...objects.map((o) => plan.stages.indexOf(o.itemId) + 1),
    );
    return { plan, reached, objects };
  });
  return { items, builds };
}

// The API shape of rewardCatalog: plain ids, no nested objects.
export function homebaseRewards(db: Garden, homebaseId: string, now: string) {
  const catalog = rewardCatalog(db, homebaseId, now);
  return {
    homebaseId,
    items: catalog.items.map(
      ({ item, status, inGarden, planned, waiting }) => ({
        itemId: item.id,
        name: item.name,
        category: item.category,
        status:
          status.kind === "ready"
            ? {
                kind: status.kind,
                precursorId: status.precursorId,
                targetObjectId: status.target.id,
              }
            : status,
        inGarden,
        planned,
        waiting,
      }),
    ),
    builds: catalog.builds.map(({ plan, reached }) => ({
      id: plan.id,
      name: plan.name,
      stages: [...plan.stages],
      reached,
    })),
  };
}

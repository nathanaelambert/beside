import { buildPlans, precursorChain, precursorOf } from "@beside/rewards";
import type { Database, GardenObject, Reward } from "./types.ts";

export { buildPlans, precursorChain, precursorOf } from "@beside/rewards";

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

/** Not yet applied to the garden: unearned, or earned and waiting. */
const pending = (reward: Reward) => !reward.gardenObjectId;

/** The object an upgrade builds on, once its chosen precursor exists. */
export function resolvedTarget(db: Pick<Database, "rewards">, reward: Reward) {
  return (
    reward.targetObjectId ??
    db.rewards.find((r) => r.id === reward.targetRewardId)?.gardenObjectId ??
    null
  );
}

export const milestoneFor = (
  db: Pick<Database, "milestones">,
  rewardId: string,
) => db.milestones.find((m) => m.rewardId === rewardId);

// What a live pending upgrade has already claimed: one object or one planned
// reward each. A claimed precursor cannot carry a second upgrade.
function claims(
  db: Garden,
  homebaseId: string,
  now: string,
  ignoreRewardId?: string,
) {
  const objects = new Set<string>();
  const rewards = new Set<string>();
  for (const r of db.rewards) {
    if (
      r.homebaseId !== homebaseId ||
      r.id === ignoreRewardId ||
      !pending(r) ||
      !precursorOf(r.itemId) ||
      !liveReward(db, r, now)
    )
      continue;
    const object = resolvedTarget(db, r);
    if (object) objects.add(object);
    if (r.targetRewardId) rewards.add(r.targetRewardId);
  }
  return { objects, rewards };
}

export type PrecursorCandidate =
  | { kind: "object"; object: GardenObject; milestoneName: string | null }
  | { kind: "reward"; reward: Reward; milestoneName: string | null };

/**
 * Everything an upgrade could build on right now, oldest first: free objects
 * at the precursor stage, then planned or waiting rewards of that stage.
 */
export function precursorCandidates(
  db: Garden,
  homebaseId: string,
  itemId: string,
  now: string,
  ignoreRewardId?: string,
): PrecursorCandidate[] {
  const precursorId = precursorOf(itemId);
  if (!precursorId) return [];
  const claimed = claims(db, homebaseId, now, ignoreRewardId);
  const objects = db.gardenObjects
    .filter(
      (o) =>
        o.homebaseId === homebaseId &&
        o.itemId === precursorId &&
        !claimed.objects.has(o.id),
    )
    .sort(byAge)
    .map((object) => {
      // The milestone that first earned this object; none for the starter oak.
      const first = gardenHistory(db, object)[0];
      return {
        kind: "object" as const,
        object,
        milestoneName: (first && milestoneFor(db, first.id)?.name) ?? null,
      };
    });
  const rewards = db.rewards
    .filter(
      (r) =>
        r.homebaseId === homebaseId &&
        r.itemId === precursorId &&
        pending(r) &&
        liveReward(db, r, now) &&
        !claimed.rewards.has(r.id),
    )
    .map((reward) => ({
      kind: "reward" as const,
      reward,
      milestoneName: milestoneFor(db, reward.id)?.name ?? null,
    }));
  return [...objects, ...rewards];
}

export type RewardStatus =
  // No precursor: a new object for the garden.
  | { kind: "place" }
  // At least one free precursor stands in the garden.
  | { kind: "ready"; precursorId: string; candidates: PrecursorCandidate[] }
  // Only planned or earned-and-waiting precursors are free. Plannable; it is
  // applied once that precursor exists.
  | { kind: "queued"; precursorId: string; candidates: PrecursorCandidate[] }
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
  const candidates = precursorCandidates(
    db,
    homebaseId,
    itemId,
    now,
    ignoreRewardId,
  );
  if (!candidates.length)
    return { kind: "locked", precursorId, chain: precursorChain(itemId) };
  return candidates[0]!.kind === "object"
    ? { kind: "ready", precursorId, candidates }
    : { kind: "queued", precursorId, candidates };
}

export const itemName = (db: Pick<Database, "rewardItems">, itemId: string) =>
  db.rewardItems.find((item) => item.id === itemId)?.name ?? itemId;

// "a Meadow oak", but plain "Cottage walls" for plural names.
export function withArticle(name: string) {
  if (/[^s]s$/.test(name)) return name;
  return `${/^[aeiou]/i.test(name) ? "an" : "a"} ${name}`;
}

export function lockedMessage(
  db: Pick<Database, "rewardItems">,
  itemId: string,
  precursorId: string,
) {
  return `${itemName(db, itemId)} needs ${withArticle(itemName(db, precursorId))} in your garden first. Plan or earn one, then try again.`;
}

/**
 * Resolve the planner's choice (or the oldest free precursor) into a target.
 * Throws a readable error when the choice is not a free precursor.
 */
export function chooseTarget(
  db: Garden,
  homebaseId: string,
  itemId: string,
  now: string,
  buildOnId: string | null | undefined,
  ignoreRewardId?: string,
): Pick<Reward, "targetObjectId" | "targetRewardId"> {
  const precursorId = precursorOf(itemId);
  if (!precursorId) {
    if (buildOnId)
      throw new Error(
        `${itemName(db, itemId)} gets its own spot and does not build on anything.`,
      );
    return { targetObjectId: null, targetRewardId: null };
  }
  const candidates = precursorCandidates(
    db,
    homebaseId,
    itemId,
    now,
    ignoreRewardId,
  );
  if (!candidates.length)
    throw new Error(lockedMessage(db, itemId, precursorId));
  const choice = buildOnId
    ? candidates.find((c) =>
        c.kind === "object"
          ? c.object.id === buildOnId
          : c.reward.id === buildOnId,
      )
    : candidates[0];
  if (!choice)
    throw new Error(
      `Choose a free ${itemName(db, precursorId)} for ${itemName(db, itemId)} to build on.`,
    );
  return choice.kind === "object"
    ? { targetObjectId: choice.object.id, targetRewardId: null }
    : { targetObjectId: null, targetRewardId: choice.reward.id };
}

export interface GardenChange {
  kind: "earned" | "upgraded";
  reward: Reward;
  object: GardenObject;
  fromItemId: string | null;
}

// Apply every obtained-but-unapplied reward, oldest first, until nothing more
// can change. A plain item arrives unplaced, ready for a member to place it.
// An upgrade changes its chosen precursor in place; a roof earned before its
// walls waits, then lands with them.
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
        const object: GardenObject = {
          id: `garden_${crypto.randomUUID()}`,
          homebaseId,
          itemId: reward.itemId,
          origin: "reward",
          x: null,
          y: null,
          createdAt: now,
          updatedAt: now,
        };
        db.gardenObjects.push(object);
        reward.gardenObjectId = object.id;
        changes.push({ kind: "earned", reward, object, fromItemId: null });
        changed = true;
        continue;
      }
      const target = db.gardenObjects.find(
        (o) => o.id === resolvedTarget(db, reward),
      );
      if (!target || target.itemId !== precursorId) continue;
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

// Rewards that created or upgraded an object, in build order. A stage earned
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

// The API shape of rewardCatalog: plain ids, no nested records.
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
          status.kind === "ready" || status.kind === "queued"
            ? {
                kind: status.kind,
                precursorId: status.precursorId,
                candidates: status.candidates.map((c) =>
                  c.kind === "object"
                    ? {
                        kind: c.kind,
                        id: c.object.id,
                        origin: c.object.origin,
                        placed: c.object.x !== null,
                        milestoneName: c.milestoneName,
                      }
                    : {
                        kind: c.kind,
                        id: c.reward.id,
                        origin: "reward" as const,
                        placed: false,
                        milestoneName: c.milestoneName,
                      },
                ),
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

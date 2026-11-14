import { earning, shopListing } from "@beside/rewards/shop";
import type {
  AcornEntry,
  AcornEntryKind,
  Database,
  Decoration,
  Milestone,
} from "./types.ts";

// Experiment: a shared acorn pool per home base. Milestones earn acorns and the
// shop sells catalog items at tiered prices. See docs/experiments/rewards-currency.md.

export const meadowBounds = { width: 288, height: 240, grid: 8 } as const;
// Two decorations cannot share a patch: the same spacing the app uses for scenery.
export const decorationSpacing = { x: 22, y: 18 } as const;

export const acornBalance = (
  db: Pick<Database, "acornEntries">,
  homebaseId: string,
) =>
  db.acornEntries
    .filter((entry) => entry.homebaseId === homebaseId)
    .reduce((sum, entry) => sum + entry.amount, 0);

type RosterSource = Pick<Database, "participations" | "logs" | "milestones">;
const joinedAt = (db: RosterSource, activityId: string, userId: string) =>
  db.logs
    .filter(
      (log) =>
        log.authorUserId === userId &&
        log.isSuccess &&
        db.milestones.some(
          (m) =>
            m.id === log.milestoneId &&
            m.kind === "join" &&
            m.activityId === activityId,
        ),
    )
    .map((log) => log.createdAt)
    .sort()[0];

/**
 * Everyone who must check in before the together bonus is paid: participants
 * still in the activity who had joined when the milestone was planned. People
 * who join later are not required; people who leave stop blocking the bonus.
 */
export function togetherRoster(
  db: RosterSource,
  milestone: Pick<Milestone, "activityId" | "createdAt">,
) {
  return db.participations
    .filter(
      (person) =>
        person.activityId === milestone.activityId &&
        (person.status === "active" || person.status === "finished"),
    )
    .filter((person) => {
      const joined = joinedAt(db, milestone.activityId, person.userId);
      return !!joined && Date.parse(joined) <= Date.parse(milestone.createdAt);
    })
    .map((person) => person.userId);
}

const checkedIn = (db: Database, milestoneId: string, userId: string) =>
  db.logs.some(
    (log) =>
      log.milestoneId === milestoneId &&
      log.authorUserId === userId &&
      log.isSuccess,
  );

function entry(
  db: Database,
  fields: Omit<AcornEntry, "id" | "createdAt"> & { kind: AcornEntryKind },
  now: string,
) {
  const row: AcornEntry = {
    id: `acorn_${crypto.randomUUID()}`,
    ...fields,
    createdAt: now,
  };
  db.acornEntries.push(row);
  return row;
}

/** Called in the same command as a successful achievement log. */
export function earnAcorns(
  db: Database,
  homebaseId: string,
  milestone: Milestone,
  userId: string,
  now: string,
) {
  if (milestone.kind !== "achievement") return { earned: 0, together: 0 };
  let earned = 0;
  let together = 0;
  if (
    !db.acornEntries.some(
      (row) =>
        row.kind === "check-in" &&
        row.milestoneId === milestone.id &&
        row.userId === userId,
    )
  ) {
    entry(
      db,
      {
        homebaseId,
        userId,
        amount: earning.checkIn,
        kind: "check-in",
        milestoneId: milestone.id,
        decorationId: null,
        note: milestone.name,
      },
      now,
    );
    earned = earning.checkIn;
  }
  const roster = togetherRoster(db, milestone);
  if (
    roster.length &&
    roster.every((person) => checkedIn(db, milestone.id, person)) &&
    !db.acornEntries.some(
      (row) => row.kind === "together" && row.milestoneId === milestone.id,
    )
  ) {
    together = earning.togetherPerPerson * roster.length;
    entry(
      db,
      {
        homebaseId,
        userId,
        amount: together,
        kind: "together",
        milestoneId: milestone.id,
        decorationId: null,
        note: `${milestone.name}: all ${roster.length} made it`,
      },
      now,
    );
  }
  return { earned, together };
}

export function placementRejection(
  db: Pick<Database, "decorations">,
  homebaseId: string,
  x: number,
  y: number,
): string | null {
  const { width, height, grid } = meadowBounds;
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x % grid !== 0 ||
    y % grid !== 0 ||
    x < 16 ||
    x > width - 16 ||
    y < 32 ||
    y > height - 8
  )
    return "Choose a spot inside the meadow.";
  if (
    db.decorations.some(
      (row) =>
        row.homebaseId === homebaseId &&
        Math.abs(row.x - x) < decorationSpacing.x &&
        Math.abs(row.y - y) < decorationSpacing.y,
    )
  )
    return "That spot is already taken.";
  return null;
}

export function purchaseRejection(
  db: Database,
  homebaseId: string,
  itemId: string,
): string | null {
  const listing = shopListing(itemId);
  if (!listing || !db.rewardItems.some((item) => item.id === itemId))
    return "That item is not for sale.";
  if (
    listing.limitPerHomebase !== null &&
    db.decorations.filter(
      (row) => row.homebaseId === homebaseId && row.itemId === itemId,
    ).length >= listing.limitPerHomebase
  )
    return "Your meadow already has this legendary item.";
  const balance = acornBalance(db, homebaseId);
  if (balance < listing.price)
    return `Not enough acorns: this costs ${listing.price} and your home base has ${balance}.`;
  return null;
}

export function buyDecoration(
  db: Database,
  input: {
    actorId: string;
    homebaseId: string;
    itemId: string;
    x: number;
    y: number;
    externalKey: string | null;
  },
  now: string,
): Decoration {
  const rejection =
    purchaseRejection(db, input.homebaseId, input.itemId) ??
    placementRejection(db, input.homebaseId, input.x, input.y);
  if (rejection) throw new Error(rejection);
  const listing = shopListing(input.itemId)!;
  const decoration: Decoration = {
    id: `decoration_${crypto.randomUUID()}`,
    homebaseId: input.homebaseId,
    itemId: input.itemId,
    price: listing.price,
    purchasedByUserId: input.actorId,
    x: input.x,
    y: input.y,
    externalKey: input.externalKey,
    createdAt: now,
  };
  db.decorations.push(decoration);
  entry(
    db,
    {
      homebaseId: input.homebaseId,
      userId: input.actorId,
      amount: -listing.price,
      kind: "purchase",
      milestoneId: null,
      decorationId: decoration.id,
      note: db.rewardItems.find((item) => item.id === input.itemId)!.name,
    },
    now,
  );
  return decoration;
}

/** Return a decoration to the shop for a full refund of what was paid. */
export function returnDecoration(
  db: Database,
  decoration: Decoration,
  actorId: string,
  now: string,
) {
  for (const row of db.acornEntries)
    if (row.decorationId === decoration.id) row.decorationId = null;
  db.decorations = db.decorations.filter((row) => row.id !== decoration.id);
  if (decoration.price > 0)
    entry(
      db,
      {
        homebaseId: decoration.homebaseId,
        userId: actorId,
        amount: decoration.price,
        kind: "refund",
        milestoneId: null,
        decorationId: null,
        note:
          db.rewardItems.find((item) => item.id === decoration.itemId)?.name ??
          decoration.itemId,
      },
      now,
    );
}

/** Keep earned acorns when their milestones disappear; drop a deleted base's pool. */
export function detachAcorns(
  db: Database,
  milestoneIds: Set<string>,
  homebaseIds: Set<string>,
) {
  db.acornEntries = db.acornEntries.filter(
    (row) => !homebaseIds.has(row.homebaseId),
  );
  db.decorations = db.decorations.filter(
    (row) => !homebaseIds.has(row.homebaseId),
  );
  for (const row of db.acornEntries)
    if (row.milestoneId && milestoneIds.has(row.milestoneId))
      row.milestoneId = null;
}

import type { ApiState } from "@beside/api-client"
import {
  acornBalance,
  earning,
  rarityTiers,
  shopListings,
  togetherRoster,
  type Rarity,
  type ShopListing,
} from "@beside/api-client/acorns"

type Entry = ApiState["acornEntries"][number]

export { acornLabel, acornArt, rarityOrder, rarityTiers } from "@beside/api-client/acorns"
export type { Rarity }

/** The home base's shared pool: balance and newest-first history. */
export function homebaseAcorns(state: Pick<ApiState, "acornEntries">, homebaseId: string) {
  return {
    balance: acornBalance(state, homebaseId),
    history: state.acornEntries
      .filter((entry) => entry.homebaseId === homebaseId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.amount - a.amount),
  }
}

/** What a milestone pays, so people know what showing up is worth before they do. */
export function milestoneEarnings(
  state: Pick<ApiState, "participations" | "logs" | "milestones" | "acornEntries">,
  milestone: Pick<ApiState["milestones"][number], "id" | "activityId" | "createdAt">,
) {
  const roster = togetherRoster(state, milestone)
  const entries = state.acornEntries.filter((entry) => entry.milestoneId === milestone.id)
  return {
    checkIn: earning.checkIn,
    rosterSize: roster.length,
    togetherBonus: earning.togetherPerPerson * roster.length,
    checkedIn: entries.filter((entry) => entry.kind === "check-in").map((entry) => entry.userId),
    together: entries.find((entry) => entry.kind === "together"),
  }
}

export interface ShopCard extends ShopListing {
  owned: number
  affordable: boolean
  soldOut: boolean
  /** Acorns still needed; zero when affordable. */
  missing: number
}

export function shopCards(
  balance: number,
  decorations: Pick<ApiState["decorations"][number], "itemId">[],
): ShopCard[] {
  return shopListings.map((listing) => {
    const owned = decorations.filter((row) => row.itemId === listing.itemId).length
    const soldOut = listing.limitPerHomebase !== null && owned >= listing.limitPerHomebase
    return {
      ...listing,
      owned,
      soldOut,
      affordable: !soldOut && balance >= listing.price,
      missing: Math.max(0, listing.price - balance),
    }
  })
}

/** Plain-language nudge for an item the base cannot afford yet. */
export function earnHint(missing: number, rosterSize: number) {
  const together = earning.checkIn + earning.togetherPerPerson
  const perSession = Math.max(1, rosterSize) * together
  const sessions = Math.ceil(missing / perSession)
  return sessions <= 1
    ? `One milestone where everyone shows up earns ${perSession}.`
    : `About ${sessions} milestones where everyone shows up (${perSession} each).`
}

export function entryLabel(entry: Entry, names: Map<string, string>) {
  const who = names.get(entry.userId)?.split(/\s+/)[0] ?? "Someone"
  switch (entry.kind) {
    case "check-in":
      return `${who} checked in · ${entry.note}`
    case "together":
      return `Together bonus · ${entry.note}`
    case "purchase":
      return `${who} bought ${entry.note}`
    case "refund":
      return `${who} returned ${entry.note}`
  }
}

export const tierFor = (rarity: Rarity) => rarityTiers[rarity]

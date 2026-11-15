import type {
  GardenObject,
  HomebaseRewards,
  PrecursorCandidateView,
  RewardStatusView,
} from "@beside/api-client"
import {
  checkGardenPlacement,
  gardenPlacements,
  Ground,
  groundAt,
  snapMeadowPoint,
  type MeadowPoint,
} from "@beside/api-client/garden"
import { withArticle } from "@beside/api-client/precursors"

import { catalogue, type WorldItem } from "./scene"

export const gardenKey = (objectId: string) => `garden:${objectId}`

const placed = (o: GardenObject): o is GardenObject & { x: number; y: number } =>
  o.x !== null && o.y !== null

/** Placed garden objects, as world sprites drawn alongside the meadow's scenery. */
export function gardenItems(objects: GardenObject[], homebaseId: string): WorldItem[] {
  return objects
    .filter((o) => o.homebaseId === homebaseId)
    .filter(placed)
    .map((o) => ({ key: gardenKey(o.id), itemId: o.itemId, x: o.x, y: o.y }))
}

/** Earned objects still waiting for a member to choose their spot. */
export const unplacedObjects = (objects: GardenObject[], homebaseId: string) =>
  objects.filter((o) => o.homebaseId === homebaseId && !placed(o))

/** Spots taken by everything placed, except the object being moved. */
export const occupiedSpots = (
  objects: GardenObject[],
  homebaseId: string,
  exceptId?: string,
): MeadowPoint[] =>
  objects
    .filter((o) => o.homebaseId === homebaseId && o.id !== exceptId)
    .filter(placed)
    .map(({ x, y }) => ({ x, y }))

/** The server's placement rule, plus the ground under the finger itself. */
export function placementTap(x: number, y: number, occupied: readonly MeadowPoint[]) {
  const point = snapMeadowPoint(x, y)
  const rejection =
    groundAt(x, y, "group") === Ground.Lawn ? checkGardenPlacement(point, occupied) : "terrain"
  return { point, rejection }
}

/** Marked spots for the placement guide: only spots a tap would accept. */
export const placementGuide = (occupied: readonly MeadowPoint[]) =>
  gardenPlacements(occupied).filter(({ x, y }) => !placementTap(x, y, occupied).rejection)

export const itemLabel = (itemId: string) => catalogue.get(itemId)?.name ?? itemId

/** "a Meadow oak", but plain "Cottage walls": article for prose about precursors. */
export const aItem = (itemId: string) => withArticle(itemLabel(itemId))

/** How a planner recognises one precursor choice. */
export function candidateLabel(candidate: PrecursorCandidateView, precursorId: string) {
  const name = itemLabel(precursorId)
  if (candidate.origin === "starter") return `Your starter ${name.replace(/^Meadow /, "")}`
  const from = candidate.milestoneName ? ` from “${candidate.milestoneName}”` : ""
  if (candidate.kind === "reward") return `The planned ${name}${from}`
  return `${name}${from}${candidate.placed ? "" : " (not placed yet)"}`
}

export type StatusTone = "open" | "ready" | "queued" | "locked"

/** What one catalog entry needs, in a short line for chips and pickers. */
export function statusLine(status: RewardStatusView): { tone: StatusTone; text: string } {
  switch (status.kind) {
    case "place":
      return { tone: "open", text: "Available · you choose its spot" }
    case "ready":
      return {
        tone: "ready",
        text:
          status.candidates.length > 1
            ? `Ready · pick which ${itemLabel(status.precursorId)} it builds on`
            : `Ready · builds on your ${itemLabel(status.precursorId)}`,
      }
    case "queued":
      return {
        tone: "queued",
        text: `Queued · builds on the planned ${itemLabel(status.precursorId)}`,
      }
    case "locked":
      return { tone: "locked", text: `Locked · needs ${aItem(status.precursorId)}` }
  }
}

export type CatalogEntry = HomebaseRewards["items"][number]

export const plannable = (entry: CatalogEntry) => entry.status.kind !== "locked"

export const candidatesOf = (status: RewardStatusView | undefined) =>
  status && (status.kind === "ready" || status.kind === "queued") ? status.candidates : []

/** The newest change among placed objects that this device has not shown yet. */
export function unseenChange(
  objects: GardenObject[],
  homebaseId: string,
  seen: Record<string, string>,
): GardenObject | undefined {
  return objects
    .filter((o) => o.homebaseId === homebaseId && placed(o) && seen[o.id] !== seenStamp(o))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]
}

export const seenStamp = (object: GardenObject) =>
  `${object.itemId}@${object.x},${object.y}@${object.updatedAt}`

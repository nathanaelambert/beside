import type { GardenObject, HomebaseRewards, RewardStatusView } from "@beside/api-client"
import { withArticle } from "@beside/api-client/precursors"

import { catalogue, type WorldItem } from "./scene"

export const gardenKey = (objectId: string) => `garden:${objectId}`

/** Earned objects with a plot, as world sprites drawn alongside the meadow's scenery. */
export function gardenItems(objects: GardenObject[], homebaseId: string): WorldItem[] {
  return objects
    .filter((o) => o.homebaseId === homebaseId && o.x !== null && o.y !== null)
    .map((o) => ({ key: gardenKey(o.id), itemId: o.itemId, x: o.x!, y: o.y! }))
}

export const itemLabel = (itemId: string) => catalogue.get(itemId)?.name ?? itemId

/** "a Meadow oak", but plain "Cottage walls": article for prose about precursors. */
export const aItem = (itemId: string) => withArticle(itemLabel(itemId))

export type StatusTone = "open" | "ready" | "queued" | "locked"

/** What one catalog entry needs, in a short line for chips and pickers. */
export function statusLine(status: RewardStatusView): { tone: StatusTone; text: string } {
  switch (status.kind) {
    case "place":
      return { tone: "open", text: "Available · gets its own spot" }
    case "ready":
      return { tone: "ready", text: `Ready · builds on your ${itemLabel(status.precursorId)}` }
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

/** The newest change in the garden that this device has not shown yet. */
export function unseenChange(
  objects: GardenObject[],
  homebaseId: string,
  seen: Record<string, string>,
): GardenObject | undefined {
  return objects
    .filter((o) => o.homebaseId === homebaseId && seen[o.id] !== `${o.itemId}@${o.updatedAt}`)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]
}

export const seenStamp = (object: GardenObject) => `${object.itemId}@${object.updatedAt}`

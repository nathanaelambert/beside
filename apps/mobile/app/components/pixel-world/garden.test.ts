import { gardenPlots } from "@beside/api-client/precursors"
import { rewardItems } from "@beside/rewards"

import { avatarsForMembers } from "./avatars"
import { gardenItems, statusLine, unseenChange } from "./garden"
import { footprint, initialItems } from "./scene"
import { getTerrain, Ground, GROUP_BLANKET, WORLD_HEIGHT, WORLD_WIDTH } from "./terrain"

const lawn = (x: number, y: number) =>
  x >= 0 &&
  y >= 0 &&
  x < WORLD_WIDTH &&
  y < WORLD_HEIGHT &&
  getTerrain("group").ground[y * WORLD_WIDTH + x] === Ground.Lawn

describe("garden plots", () => {
  it("rest every earned object's base on open lawn, clear of the picnic, scenery and each other", () => {
    const friends = avatarsForMembers(
      Array.from({ length: 8 }, (_, i) => ({ id: `m${i}`, name: `Member ${i}` })),
    )
    for (const plot of gardenPlots) {
      expect(plot.x % 8).toBe(0)
      expect(plot.y % 8).toBe(0)
      // The widest sprite base (the cottage slab) spans about 26 pixels.
      for (let dx = -13; dx <= 13; dx++)
        for (let dy = -6; dy <= 0; dy++) expect(lawn(plot.x + dx, plot.y + dy)).toBe(true)
      expect(
        plot.x >= GROUP_BLANKET.x0 - 12 &&
          plot.x <= GROUP_BLANKET.x1 + 12 &&
          plot.y >= GROUP_BLANKET.y0 - 4 &&
          plot.y <= GROUP_BLANKET.y1 + 30,
      ).toBe(false)
      for (const item of [...initialItems, ...friends])
        expect(Math.abs(item.x - plot.x) < 22 && Math.abs(item.y - plot.y) < 18).toBe(false)
    }
    for (const [i, a] of gardenPlots.entries())
      for (const b of gardenPlots.slice(i + 1))
        expect(Math.abs(a.x - b.x) < 28 && Math.abs(a.y - b.y) < 22).toBe(false)
  })

  it("keeps the new sprites on the shared ground line", () => {
    for (const id of [
      "christmas-tree",
      "cottage-foundation",
      "cottage-walls",
      "cottage-roof",
      "cottage",
    ]) {
      const item = rewardItems.find((candidate) => candidate.id === id)!
      expect(footprint(item.artifact).bottom).toBe(29)
    }
  })
})

describe("garden helpers", () => {
  const object = (id: string, itemId: string, updatedAt: string, x: number | null = 168) => ({
    id,
    homebaseId: "base",
    itemId,
    x,
    y: x === null ? null : 120,
    createdAt: "2026-11-13T10:00:00.000Z",
    updatedAt,
  })

  it("draws placed objects of this home base only", () => {
    expect(
      gardenItems(
        [
          object("a", "oak-tree", "2026-11-13T10:00:00.000Z"),
          object("b", "sunflower", "2026-11-13T10:00:00.000Z", null),
          { ...object("c", "oak-tree", "2026-11-13T10:00:00.000Z"), homebaseId: "other" },
        ],
        "base",
      ),
    ).toEqual([{ key: "garden:a", itemId: "oak-tree", x: 168, y: 120 }])
  })

  it("finds the newest change this device has not seen", () => {
    const tree = object("a", "christmas-tree", "2026-11-13T12:00:00.000Z")
    const house = object("b", "cottage-walls", "2026-11-13T11:00:00.000Z")
    expect(unseenChange([tree, house], "base", {})?.id).toBe("a")
    expect(
      unseenChange([tree, house], "base", { a: "christmas-tree@2026-11-13T12:00:00.000Z" })?.id,
    ).toBe("b")
  })

  it("says what a locked or queued reward needs", () => {
    expect(statusLine({ kind: "locked", precursorId: "oak-tree", chain: ["oak-tree"] })).toEqual({
      tone: "locked",
      text: "Locked · needs a Meadow oak",
    })
    expect(statusLine({ kind: "locked", precursorId: "cottage-walls", chain: [] }).text).toBe(
      "Locked · needs Cottage walls",
    )
    expect(statusLine({ kind: "queued", precursorId: "cottage-walls" }).text).toBe(
      "Queued · builds on the planned Cottage walls",
    )
  })
})

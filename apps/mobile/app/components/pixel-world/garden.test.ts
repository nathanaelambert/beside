import { rewardItems } from "@beside/rewards"

import {
  candidateLabel,
  gardenItems,
  occupiedSpots,
  placementGuide,
  placementTap,
  statusLine,
  unplacedObjects,
  unseenChange,
} from "./garden"
import { footprint } from "./scene"

const object = (
  id: string,
  itemId: string,
  updatedAt: string,
  x: number | null = 168,
  origin: "reward" | "starter" = "reward",
) => ({
  id,
  homebaseId: "base",
  itemId,
  origin,
  x,
  y: x === null ? null : 120,
  createdAt: "2026-11-13T10:00:00.000Z",
  updatedAt,
})

describe("garden placement", () => {
  it("only marks spots a tap would accept, clear of everything already placed", () => {
    const free = placementGuide([])
    expect(free.length).toBeGreaterThan(10)
    const taken = free[0]
    const guide = placementGuide([taken])
    expect(guide.some((p) => p.x === taken.x && p.y === taken.y)).toBe(false)
    expect(guide.length).toBeLessThan(free.length)
    for (const p of guide) expect(placementTap(p.x, p.y, [taken]).rejection).toBeNull()
    expect(placementTap(taken.x, taken.y, [taken]).rejection).toBe("occupied")
    // The pond.
    expect(placementTap(224, 152, []).rejection).toBe("terrain")
  })

  it("excludes the object being moved from the occupied spots", () => {
    const objects = [
      object("a", "oak-tree", "2026-11-13T10:00:00.000Z", 104),
      object("b", "sunflower", "2026-11-13T10:00:00.000Z", null),
    ]
    expect(occupiedSpots(objects, "base")).toEqual([{ x: 104, y: 120 }])
    expect(occupiedSpots(objects, "base", "a")).toEqual([])
    expect(unplacedObjects(objects, "base").map((o) => o.id)).toEqual(["b"])
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

  it("finds the newest placed change this device has not seen", () => {
    const tree = object("a", "christmas-tree", "2026-11-13T12:00:00.000Z")
    const house = object("b", "cottage-walls", "2026-11-13T11:00:00.000Z")
    const unplaced = object("c", "sunflower", "2026-11-13T13:00:00.000Z", null)
    expect(unseenChange([tree, house, unplaced], "base", {})?.id).toBe("a")
    expect(
      unseenChange([tree, house], "base", {
        a: "christmas-tree@168,120@2026-11-13T12:00:00.000Z",
      })?.id,
    ).toBe("b")
  })

  it("says what a reward needs and names each precursor choice", () => {
    expect(statusLine({ kind: "locked", precursorId: "oak-tree", chain: ["oak-tree"] })).toEqual({
      tone: "locked",
      text: "Locked · needs a Meadow oak",
    })
    expect(statusLine({ kind: "locked", precursorId: "cottage-walls", chain: [] }).text).toBe(
      "Locked · needs Cottage walls",
    )
    const starter = {
      kind: "object" as const,
      id: "s",
      origin: "starter" as const,
      placed: true,
      milestoneName: null,
    }
    const earned = { ...starter, id: "e", origin: "reward" as const, milestoneName: "Plant a tree" }
    expect(
      statusLine({ kind: "ready", precursorId: "oak-tree", candidates: [starter, earned] }).text,
    ).toBe("Ready · pick which Meadow oak it builds on")
    expect(candidateLabel(starter, "oak-tree")).toBe("Your starter oak")
    expect(candidateLabel(earned, "oak-tree")).toBe("Meadow oak from “Plant a tree”")
    expect(
      candidateLabel(
        { ...earned, kind: "reward", placed: false, milestoneName: "Lay the foundation" },
        "cottage-foundation",
      ),
    ).toBe("The planned Cottage foundation from “Lay the foundation”")
  })
})

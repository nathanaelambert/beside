import { hitTest, initialItems, placementAt, type WorldItem } from "./scene"

describe("pixel world interactions", () => {
  it("selects the frontmost sprite when touch targets overlap", () => {
    const items: WorldItem[] = [
      { key: "back", itemId: "oak-tree", x: 100, y: 100 },
      { key: "front", itemId: "pink-tulip", x: 100, y: 110 },
    ]
    expect(hitTest(items, 100, 90, 2)?.key).toBe("front")
    expect(items[0].key).toBe("back")
  })

  it("provides a 44pt target at the smallest pixel scale", () => {
    expect(hitTest(initialItems, 162, 108, 1)?.key).toBe("owl")
    expect(hitTest(initialItems, 280, 230, 2)).toBeUndefined()
  })

  it("snaps a valid placement and rejects water, occupied spots, and the map edge", () => {
    expect(placementAt(105, 175, initialItems)).toEqual({ x: 104, y: 176 })
    expect(placementAt(200, 144, initialItems)).toBeNull()
    expect(placementAt(144, 104, initialItems)).toBeNull()
    expect(placementAt(8, 200, initialItems)).toBeNull()
  })
})

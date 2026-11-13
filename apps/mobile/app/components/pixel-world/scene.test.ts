import { checkStarterOakPlacement, snapMeadowPoint } from "@beside/api-client/garden"
import { rewardItems } from "@beside/rewards"

import { avatarAt, footprint, hitTest, initialItems, placementAt, type WorldItem } from "./scene"
import { oakAt } from "./starterOak"
import { BLANKET, DOCK, Ground, groundAt } from "./terrain"

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

  it("keeps placements off the path, picnic blanket, and dock", () => {
    expect(groundAt(150, 160)).toBe(Ground.Path)
    expect(placementAt(150, 168, [])).toBeNull()
    expect(placementAt((BLANKET.x0 + BLANKET.x1) / 2, BLANKET.y1, [])).toBeNull()
    expect(groundAt(DOCK.x0 + 8, DOCK.y0 + 2)).toBe(Ground.Dock)
    expect(placementAt(DOCK.x0 + 8, DOCK.y1, [])).toBeNull()
  })

  it("lets each of the two friends be tapped", () => {
    expect(avatarAt(145, 138, 2)?.key).toBe("you")
    expect(avatarAt(159, 138, 2)?.key).toBe("nathaniel")
    expect(avatarAt(100, 100, 2)).toBeUndefined()
  })

  it("snaps a new lawn position without changing the saved sprite anchor", () => {
    const point = snapMeadowPoint(103, 101)
    expect(point).toEqual({ x: 104, y: 104 })
    expect(checkStarterOakPlacement(point)).toBeNull()
    expect(oakAt(point)).toMatchObject({ itemId: "oak-tree", ...point })
    expect(checkStarterOakPlacement({ x: 224, y: 144 })).toBe("terrain")
    expect(checkStarterOakPlacement({ x: 144, y: 104 })).toBe("occupied")
    expect(checkStarterOakPlacement({ x: 112, y: 104 })).toBeNull()
    expect(checkStarterOakPlacement({ x: 176, y: 104 })).toBeNull()
  })

  it("measures every catalogue sprite's base for its ground shadow", () => {
    for (const item of rewardItems) {
      const box = footprint(item.artifact)
      expect(box.bottom).toBeGreaterThanOrEqual(28)
      expect(box.right).toBeGreaterThan(box.left)
    }
  })
})

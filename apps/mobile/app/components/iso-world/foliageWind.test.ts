import { foliageBands, foliageGust, foliagePhase } from "./foliageWind"
import { buildHomeScene, itemDrawable } from "./scene"

it("uses a steady, stepped breeze with a neutral pose and both leaning directions", () => {
  const phase = foliagePhase(100, 132)
  const cycle = Array.from({ length: 36 }, (_, tick) => foliageGust(tick, phase))
  expect([...new Set(cycle)].sort()).toEqual([-1, 0, 1])
  expect(cycle.filter((pose) => pose === 0)).toHaveLength(24)
  expect(foliageGust(17, phase)).toBe(foliageGust(17 + 36, phase))
  expect(foliagePhase(116, 140)).not.toBe(phase)
})

it("keeps the lower rows fixed for mature trees and small sprouts", () => {
  const height = { y: 10, height: 32, baseY: 41 }
  const tree = foliageBands({ ...height, top: 11 }, "tree")
  expect(tree).toEqual({ canopy: 21, root: 30, tipTravel: 2 })
  const sprout = foliageBands({ ...height, top: 35 }, "tree")
  expect(sprout).toEqual({ canopy: 36, root: 36, tipTravel: 1 })
  const flower = foliageBands({ ...height, top: 27 }, "flower")
  expect(flower).toEqual({ canopy: 35, root: 35, tipTravel: 1 })
})

it("animates map vegetation and placed plants, not solids or the placement ghost", () => {
  const scene = buildHomeScene({
    avatars: [],
    items: [
      { key: "starter-oak", itemId: "oak-tree", x: 104, y: 104 },
      { key: "garden-flower", itemId: "sunflower", x: 184, y: 104 },
      { key: "bench", itemId: "reading-bench", x: 104, y: 120 },
    ],
    activities: [{ id: "home", name: "Cottage" }],
  })
  expect(scene.drawables.some((d) => d.key.startsWith("prop-") && d.foliage === "tree")).toBe(true)
  expect(scene.drawables.some((d) => d.key.startsWith("prop-") && d.foliage === "shrub")).toBe(true)
  expect(scene.drawables.find((d) => d.key === "starter-oak")?.foliage).toBe("tree")
  expect(scene.drawables.find((d) => d.key === "garden-flower")?.foliage).toBe("flower")
  expect(scene.drawables.find((d) => d.key === "bench")?.foliage).toBeUndefined()
  expect(scene.drawables.find((d) => d.key === "house-home")?.foliage).toBeUndefined()
  const point = itemDrawable(scene.frame, scene.map, "placement-preview", "oak-tree", 6.5, 6.5, {
    opacity: 0.72,
  })
  expect(point?.foliage).toBeUndefined()
})

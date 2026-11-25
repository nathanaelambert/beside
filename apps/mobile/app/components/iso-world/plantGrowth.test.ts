import type { HomebaseGarden } from "@beside/api-client"

import { gardenGrowthDeadline, plantArtStage } from "./plantGrowth"
import { isoToScreen, meadowToIso } from "./projection"
import { buildHomeScene, type Drawable } from "./scene"

const startTime = Date.parse("2026-11-20T00:00:00Z")
const started = new Date(startTime).toISOString()

it("keeps legacy plants mature and advances new ones at public time boundaries", () => {
  expect(plantArtStage(undefined, startTime)).toBe("mature")
  expect(plantArtStage("bad-date", startTime)).toBe("mature")
  expect(
    [0, 9999, 10_000, 19_999, 20_000].map((t) => plantArtStage(started, startTime + t)),
  ).toEqual(["sprout", "sprout", "young", "young", "mature"])
})

it("only schedules clocks for dated plants, not decorations or legacy placements", () => {
  const placement = { x: 104, y: 104, placedAt: started, placedByUserId: null }
  const garden: HomebaseGarden = {
    oak: { ...placement, itemId: "oak-tree", growthStartedAt: started },
    rewards: [
      { ...placement, rewardId: "legacy-plant", itemId: "pink-tulip" },
      {
        ...placement,
        rewardId: "non-plant",
        itemId: "stone-lantern",
        growthStartedAt: new Date(startTime + 90_000).toISOString(),
      },
    ],
  }
  expect(gardenGrowthDeadline([undefined, garden])).toBe(startTime + 20_000)
  expect(gardenGrowthDeadline([{ ...garden, oak: null }])).toBe(0)
})

it("changes only the staged art while retaining main-island anchors and selections", () => {
  const items = [
    { key: "starter-oak", itemId: "oak-tree", x: 104, y: 104 },
    { key: "reward-flower", itemId: "sunflower", x: 184, y: 104 },
  ]
  const where = ({ baseX, baseY, depth, hit }: Drawable) => ({
    baseX,
    baseY,
    depth,
    hit,
  })
  const phases = ["sprout", "young", "mature"] as const
  const scenes = phases.map((stage) =>
    buildHomeScene({ avatars: [], items: items.map((p) => ({ ...p, stage })) }),
  )
  for (const item of items) {
    const examples = scenes.map((scene) => scene.drawables.find((d) => d.key === item.key)!)
    const { u, v } = meadowToIso(item.x, item.y)
    const anchor = isoToScreen(scenes[0]!.frame, u, v)
    expect(examples.map((d) => [d.baseX, d.baseY])).toEqual(phases.map(() => [anchor.x, anchor.y]))
    expect(examples.map(where)).toEqual(phases.map(() => where(examples[0]!)))
    for (const [index, stage] of phases.entries()) {
      const size = item.key === "starter-oak" && stage === "mature" ? 40 : 32
      expect(examples[index]).toMatchObject({
        x: anchor.x - size / 2,
        y: anchor.y - size + 1,
        width: size,
        height: size,
      })
    }
    expect(new Set(examples.map((d) => d.source.type === "art" && d.source.art)).size).toBe(3)
  }
})

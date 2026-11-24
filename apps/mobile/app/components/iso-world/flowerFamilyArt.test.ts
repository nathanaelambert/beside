import { rewardItems } from "@beside/rewards"

import { bayFrame, bayTerrain, buildBayScene } from "./bayWorkshop"
import { flowerFamilyArt } from "./flowerFamilyArt"
import { foliageBands } from "./foliageWind"
import { buildHomeScene, itemDrawable, opaqueAt, type Drawable } from "./scene"
import { treeArtStages } from "./worldDetailArt"
import { AVATAR_HEIGHT } from "../pixel-world/avatars"

const flowerIds = rewardItems.filter((item) => item.category === "Flowers").map((item) => item.id)
const placement = ({ x, y, width, height, baseX, baseY, depth, shadow, hit }: Drawable) => ({
  x,
  y,
  width,
  height,
  baseX,
  baseY,
  depth,
  shadow,
  hit,
})

it.each(flowerIds)("%s uses the same rooted flower art in Home Base and Bay Workshop", (id) => {
  const map = bayTerrain([], "terracotta", true)
  const original = itemDrawable(bayFrame, bayTerrain([], "terracotta"), "sample", id, 4.15, 7.5)!
  expect(original.artAsset).toBeUndefined()
  expect(original.artRows).toBeUndefined()
  expect(original.foliage).toBeUndefined()

  const tops = treeArtStages.map((stage) => {
    const frame = flowerFamilyArt(id, stage)!
    expect(frame.rows).toHaveLength(32)
    expect(frame.rows.slice(30)).toEqual([0, 0])
    const specimen = itemDrawable(bayFrame, map, "sample", id, 4.15, 7.5, {}, stage)!
    expect(placement(specimen)).toEqual(placement(original))
    expect(opaqueAt(specimen, specimen.baseX, specimen.y + 29)).toBe(true)
    expect(opaqueAt(specimen, specimen.baseX, specimen.y + 30)).toBe(false)

    const workshop = buildBayScene(map, "terracotta", 3, {
      view: "garden",
      sampleId: id,
      treeStage: stage,
    }).drawables.find((d) => d.key === "bay-sample")!
    const world = buildHomeScene({
      avatars: [],
      items: [{ key: "planted", itemId: id, x: 104, y: 104, stage }],
    }).drawables.find((d) => d.key === "planted")!
    for (const d of [specimen, workshop, world]) {
      expect(d.artRows).toBe(frame.rows)
      expect(d.artAsset).toBe(frame.asset)
      expect(d.foliage).toBe("flower")
      expect(d.top).toBe(d.y + frame.rows.findIndex(Boolean))
      const { canopy, root, tipTravel } = foliageBands(d, "flower")
      expect(canopy).toBeGreaterThan(d.top)
      expect(root).toBeLessThanOrEqual(d.y + 29)
      expect(tipTravel).toBe(1)
    }
    return specimen.top
  })
  expect(tops[0]).toBeGreaterThan(tops[1]!)
  expect(tops[1]).toBeGreaterThan(tops[2]!)
  expect(flowerFamilyArt(id)).toBe(flowerFamilyArt(id, "mature"))
})

it("keeps the tulip compact and the lavender taller without exceeding the avatar scale", () => {
  const heights = (id: string) =>
    treeArtStages.map((stage) => {
      const rows = flowerFamilyArt(id, stage)!.rows
      return rows.length - 2 - rows.findIndex(Boolean)
    })

  expect(heights("pink-tulip")).toEqual([7, 12, 15])
  expect(heights("lavender")).toEqual([8, 13, 18])
  expect(heights("sunflower")).toEqual([8, 13, 17])
  expect(Math.max(...flowerIds.flatMap(heights))).toBeLessThan(AVATAR_HEIGHT)
})

it("leaves the tree and prop art paths alone, and keeps the flower placement ghost still", () => {
  expect(flowerFamilyArt("oak-tree")).toBeUndefined()
  expect(flowerFamilyArt("stone-lantern")).toBeUndefined()
  const map = bayTerrain([], "terracotta", true)
  const ghost = itemDrawable(bayFrame, map, "ghost", "sunflower", 4.15, 7.5, { opacity: 0.72 })!
  expect(ghost.foliage).toBeUndefined()
  expect(ghost.artRows).toBe(flowerFamilyArt("sunflower")?.rows)
})

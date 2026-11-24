import { bayFrame, bayTerrain, buildBayScene } from "./bayWorkshop"
import { foliageBands } from "./foliageWind"
import { matureTreeRows } from "./matureTreeArt"
import { buildHomeScene, itemDrawable, opaqueAt, type Drawable } from "./scene"
import { treeFamilyArt, type TreeFamilyId } from "./treeFamilyArt"
import { treeArtStages } from "./worldDetailArt"

const place = ({ baseX, baseY, depth, shadow, hit }: Drawable) => ({
  baseX,
  baseY,
  depth,
  shadow,
  hit,
})

const matureFrameSize: Record<TreeFamilyId, number> = {
  "oak-tree": 40,
  "pine-tree": 44,
  "cherry-tree": 40,
}

it.each(["oak-tree", "pine-tree"] as const)(
  "%s shares one silhouette across planted rewards, landscape and the workshop",
  (id) => {
    const home = buildHomeScene({
      avatars: [],
      items: [
        { itemId: id, key: "planted", x: 104, y: 104, stage: "mature" },
        { itemId: id, key: "landscape", x: 184, y: 104 },
      ],
    })
    const planted = home.drawables.find((d) => d.key === "planted")!
    const landscape = home.drawables.find((d) => d.key === "landscape")!
    const rim = home.drawables.find((d) => d.key.startsWith("prop-") && d.treeArt?.id === id)
    const workshop = buildBayScene(bayTerrain([], "terracotta", true), "terracotta", 3, {
      view: "garden",
      sampleId: id,
    }).drawables.find((d) => d.key === "bay-sample")
    for (const tree of [planted, landscape, rim, workshop]) {
      expect(tree?.treeArt).toEqual({ id, stage: "mature" })
      expect(tree?.foliage).toBe("tree")
      expect(tree?.artRows).toBe(matureTreeRows[id])
    }
    const original = itemDrawable(bayFrame, bayTerrain([], "terracotta"), "tree", id, 3, 4)!
    const young = itemDrawable(
      bayFrame,
      bayTerrain([], "terracotta", true),
      "tree",
      id,
      3,
      4,
      {},
      "young",
    )!
    const mature = itemDrawable(bayFrame, bayTerrain([], "terracotta", true), "tree", id, 3, 4)!
    expect(original.treeArt).toBeUndefined()
    expect(young.treeArt).toEqual({ id, stage: "young" })
    expect(place(mature)).toEqual(place(original))
    expect(place(mature)).toEqual(place(young))
  },
)

it.each<TreeFamilyId>(["oak-tree", "pine-tree", "cherry-tree"])(
  "%s grows upward from the same root, with breeze in all three phases",
  (id) => {
    const map = bayTerrain([], "terracotta", true)
    const ages = treeArtStages.map((stage) => {
      const rows = treeFamilyArt(id, stage)!.rows
      const size = stage === "mature" ? matureFrameSize[id] : 32
      expect(rows).toHaveLength(size)
      expect(rows.slice(-2)).toEqual([0, 0])
      const tree = itemDrawable(bayFrame, map, "tree", id, 3, 4, {}, stage)!
      expect(tree.width).toBe(size)
      expect(tree.height).toBe(size)
      expect(tree.x).toBe(tree.baseX - size / 2)
      expect(tree.y).toBe(tree.baseY - size + 1)
      expect(opaqueAt(tree, tree.baseX, tree.baseY - 2)).toBe(true)
      expect(opaqueAt(tree, tree.baseX, tree.baseY - 1)).toBe(false)
      expect(tree.artRows).toBe(rows)
      expect(tree.foliage).toBe("tree")
      const { root } = foliageBands(tree, "tree")
      expect(root).toBeGreaterThan(tree.top)
      expect(root).toBeLessThanOrEqual(tree.baseY - 3)
      return tree
    })
    expect(ages.map(place)).toEqual(Array(3).fill(place(ages[0]!)))
    expect(ages[1]!.top).toBeLessThan(ages[0]!.top)
    expect(ages[2]!.top).toBeLessThan(ages[1]!.top)
  },
)

it("uses the shared mature masks and keeps the pine tall and narrow next to the rounder crowns", () => {
  expect(treeFamilyArt("oak-tree", "mature")?.rows).toBe(matureTreeRows["oak-tree"])
  expect(treeFamilyArt("pine-tree", "mature")?.rows).toBe(matureTreeRows["pine-tree"])
  expect(treeFamilyArt("sunflower", "mature")).toBeUndefined()

  const silhouette = (id: TreeFamilyId) =>
    treeArtStages.map((stage) => {
      const rows = treeFamilyArt(id, stage)!.rows
      const spans = rows.filter(Boolean)
      const x0 = Math.min(...spans.map((span) => span >> 7))
      const x1 = Math.max(...spans.map((span) => span & 127))
      return { height: spans.length, width: x1 - x0 }
    })
  const pine = silhouette("pine-tree")
  const cherry = silhouette("cherry-tree")
  expect(pine.map(({ height }) => height)).toEqual([11, 23, 38])
  expect(cherry.map(({ height }) => height)).toEqual([10, 22, 33])
  const oak = silhouette("oak-tree")
  expect(pine[2]!.height).toBeGreaterThan(oak[2]!.height)
  expect(pine[2]!.width).toBeLessThan(cherry[2]!.width)
})

it("keeps all three sunflower stages visibly below the oak", () => {
  const map = bayTerrain([], "terracotta", true)
  const heights = (id: string) =>
    treeArtStages.map((stage) => {
      const item = itemDrawable(bayFrame, map, id, id, 3, 4, {}, stage)!
      return item.baseY - 1 - item.top
    })
  expect(heights("sunflower")).toEqual([8, 13, 17])
  expect(heights("oak-tree")).toEqual([10, 20, 34])
})

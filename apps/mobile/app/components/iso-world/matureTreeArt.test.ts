import { bayFrame, bayTerrain, buildBayScene } from "./bayWorkshop"
import { matureTreeRows } from "./matureTreeArt"
import { buildHomeScene, itemDrawable, type Drawable } from "./scene"
import { treeFamilyArt, type TreeFamilyId } from "./treeFamilyArt"
import { treeArtStages } from "./worldDetailArt"

const place = ({ x, y, width, height, baseX, baseY, depth, shadow, hit }: Drawable) => ({
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
      expect(rows).toHaveLength(32)
      expect(rows.slice(30)).toEqual([0, 0])
      expect(rows[29] >> 7).toBeLessThanOrEqual(16)
      expect(rows[29] & 127).toBeGreaterThan(16)
      const tree = itemDrawable(bayFrame, map, "tree", id, 3, 4, {}, stage)!
      expect(tree.artRows).toBe(rows)
      expect(tree.foliage).toBe("tree")
      return tree
    })
    expect(ages.map(place)).toEqual(Array(3).fill(place(ages[0]!)))
    expect(ages[1]!.top).toBeLessThan(ages[0]!.top)
    expect(ages[2]!.top).toBeLessThan(ages[1]!.top)
  },
)

it("preserves the approved mature oak and pine and leaves flowers out of the tree family", () => {
  expect(treeFamilyArt("oak-tree", "mature")?.rows).toBe(matureTreeRows["oak-tree"])
  expect(treeFamilyArt("pine-tree", "mature")?.rows).toBe(matureTreeRows["pine-tree"])
  expect(matureTreeRows["pine-tree"].findIndex(Boolean)).toBeLessThan(
    matureTreeRows["oak-tree"].findIndex(Boolean),
  )
  expect(treeFamilyArt("sunflower", "mature")).toBeUndefined()
})

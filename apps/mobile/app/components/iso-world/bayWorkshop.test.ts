import {
  addBayCell,
  bayCandidates,
  bayCellAt,
  bayFrame,
  bayGardenItems,
  bayTerrain,
  buildBayScene,
  readBayAdditions,
} from "./bayWorkshop"
import { isoToScreen } from "./projection"
import type { Drawable } from "./scene"
import { tileAt } from "./tilemap"
import { worldArtAssets } from "./worldArtAssets"
import { hasGrowthArt, treeArtStages } from "./worldDetailArt"

const sampleArt = worldArtAssets

it("adds exactly one attached cell, without filling the approach to the pier", () => {
  const first = { col: 6, row: 6 }
  expect(bayCandidates([])[0]).toEqual(first)
  const empty = bayTerrain([], "terracotta")
  expect(tileAt(empty, 6, 6)).toBeUndefined()
  const additions = addBayCell([], first)
  expect(additions).toEqual([first])
  expect(tileAt(bayTerrain(additions, "terracotta"), 6, 6)?.kind).toBe("grass")
  expect(addBayCell(additions, first)).toBe(additions)
  expect(addBayCell(additions, { col: 8, row: 4 })).toBe(additions)
  expect(addBayCell(additions, { col: 11, row: 10 })).toBe(additions)
  expect(readBayAdditions([first, first, { col: 8, row: 4 }, { col: 1.5, row: 2 }, null])).toEqual(
    additions,
  )
})

it("uses the same house and pier anchors for previews, terrain growth, styles and construction stages", () => {
  const additions = [{ col: 6, row: 6 }]
  const old = buildBayScene(bayTerrain([], "terracotta"), "terracotta", 3)
  const next = buildBayScene(bayTerrain(additions, "woodland"), "woodland", 0)
  expect(next.frame).toBe(old.frame)
  for (const key of ["house-bay", "bay-jetty"]) {
    const anchor = (scene: typeof old) => {
      const found = scene.drawables.find((d) => d.key === key)!
      return [found.x, found.y, found.baseX, found.baseY]
    }
    expect(anchor(next)).toEqual(anchor(old))
  }
  const point = isoToScreen(bayFrame, 6.5, 6.5)
  expect(bayCellAt(point.x, point.y)).toEqual(additions[0])
})

const registration = (d: Drawable) => {
  const { key, x, y, width, height, baseX, baseY, depth, shadow, hit } = d
  return {
    key,
    baseX,
    baseY,
    depth,
    shadow,
    hit,
    // Catalogue frames may grow upward around their fixed bottom-center point.
    bounds: d.source.type === "art" ? [x + width / 2, y + height - 1] : [x, y, width, height],
  }
}

it("changes the art without moving or reordering the scene in any view or style", () => {
  for (const style of ["terracotta", "woodland", "plum", "moss", "clubhouse"] as const) {
    const map = bayTerrain([], style)
    const painted = bayTerrain([], style, true)
    expect(painted.tiles).toEqual(map.tiles)
    for (const view of ["bay", "garden", "harbor"] as const) {
      const options = { assets: sampleArt, view }
      const original = buildBayScene(map, style, 3, options)
      const detailed = buildBayScene(painted, style, 3, options)
      expect(detailed.frame).toBe(original.frame)
      expect(detailed.offset).toEqual(original.offset)
      expect(
        detailed.drawables.filter((d) => d.key !== "house-bay-rear").map(registration),
      ).toEqual(original.drawables.map(registration))
      expect(original.drawables.every((d) => d.artAsset === undefined)).toBe(true)
      const house = detailed.drawables.find((d) => d.key === "house-bay")!
      const rear = detailed.drawables.find((d) => d.key === "house-bay-rear")
      const pier = detailed.drawables.find((d) => d.key === "bay-jetty")!
      expect(house.artAsset).toBeDefined()
      expect(pier.artAsset !== undefined).toBe(style === "terracotta")
      if (style === "terracotta") {
        expect(rear).toBeUndefined()
      } else {
        expect(rear?.artAsset).toBeDefined()
        expect(rear).toMatchObject({ baseX: house.baseX, baseY: house.baseY })
        expect(rear?.hit).toBeUndefined()
        expect(rear?.depth).toBeLessThan(house.depth)
      }
    }
  }
})

it("starts with the starter cottage and adds the wing and loft without moving its plot", () => {
  const map = bayTerrain([], "terracotta", true)
  const stages = ([0, 1, 2, 3] as const).map((level) =>
    buildBayScene(map, "terracotta", level, { assets: sampleArt }).drawables.find(
      (d) => d.key === "house-bay",
    )!,
  )
  expect(stages.map(registration)).toEqual(Array(4).fill(registration(stages[0]!)))
  expect(stages.map((d) => d.artRows)).toEqual(
    ([1, 1, 2, 3] as const).map((level) => sampleArt.cottages.clay[level].rows),
  )
  expect(stages[0]).toEqual(stages[1])
})

it("shows every catalogue item and previews plant growth in the same sample slot", () => {
  const map = bayTerrain([], "terracotta", true)
  const artSet = new Set()
  let expectedPlacement: ReturnType<typeof registration> | undefined
  for (const { id } of bayGardenItems) {
    const specimens = treeArtStages.map((treeStage) =>
      buildBayScene(map, "terracotta", 3, {
        view: "garden",
        sampleId: id,
        treeStage,
      }).drawables.find((d) => d.key === "bay-sample")!,
    )
    expectedPlacement ??= registration(specimens[0]!)
    const stages = specimens.map((d) => {
      expect(registration(d)).toEqual(expectedPlacement)
      expect(d.source.type).toBe("art")
      return d.source.type === "art" ? d.source.art : undefined
    })
    expect(new Set(stages).size).toBe(hasGrowthArt(id) ? 3 : 1)
    artSet.add(stages[2])
  }
  expect(artSet.size).toBe(bayGardenItems.length)
})

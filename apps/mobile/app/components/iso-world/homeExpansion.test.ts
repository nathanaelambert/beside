import { homeExpansionCandidates } from "@beside/api-client/homebase-expansion"

import { archipelagoLayout, islandPoint, onIsland, type IslandLayer } from "./archipelago"
import { JETTY, jetty, MOORING, SEA_LIFT } from "./archipelagoProps"
import { coastHeight } from "./coastAccess"
import { homeCoastCenter, previewHomeCoast } from "./homeExpansion"
import { paintGround } from "./paint"
import { isoToScreen } from "./projection"
import { buildHomeScene, spriteDrawable } from "./scene"
import { tileAt } from "./tilemap"
import { voyagePath, voyagePoint } from "./voyage"

const ids = ["first", "second", "third"]
const offsets = archipelagoLayout(ids)
const input = {
  avatars: [],
  activities: [{ id: "reading", name: "Reading club" }],
  items: [{ key: "oak", itemId: "oak-tree", x: 104, y: 104 }],
}

function island(key: string, coast = homeExpansionCandidates([])): IslandLayer {
  const { frame, drawables, map } = buildHomeScene({ ...input, coast })
  return {
    key,
    frame,
    drawables: [...drawables, spriteDrawable(frame, "jetty", jetty(true), { ...JETTY, lift: 0 })],
    map,
    offset: offsets[key]!,
  }
}

it("paints the same true coastline in preview and after save without rebasing existing anchors", () => {
  const choice = homeExpansionCandidates([])[0]!
  const baseline = island("first", [])
  const saved = island("first", [choice])
  const preview = previewHomeCoast(baseline, choice)
  expect(saved.map.tiles).toBe(baseline.map.tiles)
  expect(saved.frame).toBe(baseline.frame)
  expect(saved.offset).toBe(baseline.offset)
  expect(tileAt(baseline.map, choice.col, choice.row)).toBeUndefined()
  expect(tileAt(saved.map, choice.col, choice.row - 1)?.kind).toBe("forest")
  expect(tileAt(saved.map, choice.col, choice.row)).toMatchObject({
    kind: "grass",
    lift: coastHeight,
  })
  expect(tileAt(saved.map, choice.col + 1, choice.row)).toBeUndefined()
  const current = paintGround(saved.map, saved.frame)
  const previewGround = paintGround(preview.map, preview.frame)
  expect(Buffer.compare(Buffer.from(previewGround.rgba), Buffer.from(current.rgba))).toBe(0)
  const crest = (layer: IslandLayer) =>
    layer.drawables.find((d) => d.key === `block-${choice.col}-${choice.row}`)
  expect(crest(baseline)).toBeUndefined()
  expect(crest(preview)?.source).toEqual(crest(saved)?.source)
  const { u, v } = homeCoastCenter(choice)
  const sample = isoToScreen(saved.frame, u, v, coastHeight)
  const grass = crest(saved)!
  if (grass.source.type !== "bitmap") throw new Error("Expected a painted grass block")
  const bitmap = grass.source.bitmap
  expect(bitmap.rgba[((sample.y - grass.y) * bitmap.width + sample.x - grass.x) * 4 + 3]).toBe(255)
  const cliff = (layer: IslandLayer) =>
    layer.drawables.find((d) => d.key === `block-${choice.col}-${choice.row - 1}`)
  expect(cliff(saved)?.source).not.toEqual(cliff(baseline)?.source)
  expect(cliff(preview)?.source).toEqual(cliff(saved)?.source)
  const props = baseline.drawables.filter((d) => d.key.startsWith("prop-"))
  for (const key of ["house-reading", "oak", "jetty", ...props.map((d) => d.key)]) {
    const anchors = (layer: IslandLayer) => {
      const d = layer.drawables.find((drawable) => drawable.key === key)!
      return [d.x, d.y, d.baseX, d.baseY]
    }
    expect(anchors(saved)).toEqual(anchors(baseline))
    expect(anchors(preview)).toEqual(anchors(baseline))
  }
})

it("matches confirmation when preview extends a saved run and leaves no internal cliff", () => {
  const [first, second] = homeExpansionCandidates([])
  const layer = island("first", [first!])
  const saved = island("first", [first!, second!])
  const preview = previewHomeCoast(layer, second!)
  const shore = (layer: IslandLayer) => layer.drawables.filter((d) => d.key.startsWith("block-"))
  expect(shore(preview)).toEqual(shore(saved))
  expect(
    shore(layer).find((block) => block.key === `block-${first!.col}-${first!.row}`)?.source,
  ).not.toEqual(
    shore(saved).find((block) => block.key === `block-${first!.col}-${first!.row}`)?.source,
  )
})

it("leaves room for every apron tile, the sail channel and each original dock", () => {
  const baseline = ids.map((id) => island(id, []))
  const expanded = ids.map((id) => island(id))
  const mooring = { ...MOORING, lift: SEA_LIFT }
  for (const [i, from] of expanded.entries()) {
    for (const tile of from.map.coastTiles ?? []) {
      // Sample beyond the baseline wall's 14-pixel projected slab.
      const point = islandPoint(from, tile.col + 0.5, tile.row + 0.95)
      expect(onIsland(from, point)).toBe(true)
      expect(onIsland(baseline[i]!, point)).toBe(false)
    }
    expect(onIsland(from, islandPoint(from, 16.5, 15.95))).toBe(false)
    for (const [j, to] of expanded.entries()) {
      if (i === j) continue
      const route = voyagePath(from, to, expanded, mooring)
      expect(route).toEqual(voyagePath(baseline[i]!, baseline[j]!, baseline, mooring))
      expect(route.points[0]).toEqual(islandPoint(from, mooring.u, mooring.v, mooring.lift))
      expect(route.points.at(-1)).toEqual(islandPoint(to, mooring.u, mooring.v, mooring.lift))
      for (let frame = 0; frame <= 100; frame++) {
        const point = voyagePoint(route, frame / 100)
        expect(expanded.some((layer) => onIsland(layer, point))).toBe(false)
      }
    }
  }
})

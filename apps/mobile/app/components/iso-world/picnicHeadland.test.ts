import { archipelagoLayout, type IslandLayer } from "./archipelago"
import { JETTY, MOORING, SEA_LIFT } from "./archipelagoProps"
import { createBitmap, rgb, type Bitmap } from "./bitmap"
import { paintCoastFoam, picnicShoreContact, picnicShoreInfluence } from "./coastArt"
import { paintBlock, paintGround, SLAB, waterGlints } from "./paint"
import { isoToScreen } from "./projection"
import { buildHomeScene } from "./scene"
import { tileAt } from "./tilemap"
import { voyagePath } from "./voyage"

const { frame, map } = buildHomeScene({ avatars: [], items: [] })
const baseline = { ...map, coastFinish: undefined }
const alpha = ({ rgba }: Bitmap) => rgba.filter((_, i) => i % 4 === 3)

function spray(island: typeof map) {
  const bitmap = createBitmap(frame.width, frame.height)
  paintCoastFoam(bitmap, frame, island, SLAB)
  return bitmap
}

function expectBoundedColorChange(before: Bitmap, candidate: Bitmap) {
  expect(alpha(candidate)).toEqual(alpha(before))
  const changed = []
  for (let i = 0; i < before.rgba.length; i += 4) {
    if (before.rgba.subarray(i, i + 3).some((channel, c) => channel !== candidate.rgba[i + c])) {
      changed.push({ x: (i / 4) % before.width, y: Math.floor(i / 4 / before.width) })
    }
  }
  expect(changed.length).toBeGreaterThan(0)
  const start = isoToScreen(frame, 7, map.rows)
  const end = isoToScreen(frame, 15, map.rows)
  expect(
    changed.every(
      ({ x, y }) => x >= start.x - 5 && x <= end.x && y >= start.y - 8 && y <= end.y + SLAB + 5,
    ),
  ).toBe(true)
}

it("grades one left-facing front run only, including its foam and raised edge", () => {
  expectBoundedColorChange(paintGround(baseline, frame), paintGround(map, frame))
  expectBoundedColorChange(spray(baseline), spray(map))
  expect(waterGlints(map, frame)).toEqual(waterGlints(baseline, frame))
  for (const tile of map.tiles.filter(({ lift }) => lift > 0)) {
    expect(alpha(paintBlock(map, frame, tile).bitmap)).toEqual(
      alpha(paintBlock(baseline, frame, tile).bitmap),
    )
  }
  const run = tileAt(map, 10, map.rows - 1)!
  expect(picnicShoreInfluence(map, run, 0, 1, 0.5)).toBe(1)
  expect(picnicShoreInfluence(map, run, 1, 0, 0.5)).toBe(0)
  expect(picnicShoreInfluence(map, run, 0, -1, 0.5)).toBe(0)
  expect(picnicShoreInfluence(baseline, run, 0, 1, 0.5)).toBe(0)
})

it("restricts the light foam to two short salients over the original spray coverage", () => {
  const { width, rgba } = spray(map)
  const crest = rgb("#cdd2b3")
  const ledgeStart = isoToScreen(frame, 7, map.rows).x
  const marks = []
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] && crest.every((channel, c) => channel === rgba[i + c])) {
      marks.push(((i / 4) % width) - ledgeStart)
    }
  }
  expect(marks.some((x) => x >= 41 && x <= 44)).toBe(true)
  expect(marks.some((x) => x >= 84 && x <= 87)).toBe(true)
  expect(marks.every((x) => (x >= 41 && x <= 44) || (x >= 84 && x <= 87))).toBe(true)
  expect(picnicShoreContact(43, 1, "#3b2a2e")).not.toBe(picnicShoreContact(72, 1, "#3b2a2e"))
  expect(picnicShoreContact(43, 0, "#3b2a2e")).toBe("#3b2a2e")
})

it("keeps the two moorings, approach and every sample of the voyage unchanged", () => {
  const order = ["first", "second"]
  const offsets = archipelagoLayout(order)
  const layer = (key: string, layerMap: typeof map): IslandLayer => ({
    key,
    frame,
    map: layerMap,
    offset: offsets[key]!,
    drawables: [],
  })
  const from = layer("first", map)
  const to = layer("second", map)
  const oldFrom = layer("first", baseline)
  const oldTo = layer("second", baseline)
  expect(JETTY).toEqual({ u: 18, v: 8.5 })
  expect(map.tiles).toBe(baseline.tiles)
  const route = voyagePath(from, to, [from, to], MOORING)
  expect(route).toEqual(voyagePath(oldFrom, oldTo, [oldFrom, oldTo], MOORING))
  expect(route.points[0]).toEqual(isoToScreen(frame, MOORING.u, MOORING.v, SEA_LIFT))
})

import { jetty, JETTY, MOORING } from "./archipelagoProps"
import { bayFrame, bayTerrain, buildBayScene } from "./bayWorkshop"
import type { Bitmap } from "./bitmap"
import { harborBoardColor, harborTimber, jettyTimberGrade } from "./harborArt"
import { paintGround } from "./paint"
import { mapFrame } from "./projection"
import { itemDrawable, type Drawable } from "./scene"
import { tileMapFromRows } from "./tilemap"
import { worldArtAssets } from "./worldArtAssets"

const alpha = (bitmap: Bitmap) => bitmap.rgba.filter((_, i) => i % 4 === 3)
const place = ({ x, y, width, height, top, baseX, baseY, depth, hit }: Drawable) => ({
  x,
  y,
  width,
  height,
  top,
  baseX,
  baseY,
  depth,
  hit,
})

it("preserves the jetty silhouette and anchor, with no change to the mooring", () => {
  const plain = jetty()
  const detailed = jetty(true)
  expect(detailed).toMatchObject({ anchorX: plain.anchorX, anchorY: plain.anchorY })
  expect(detailed.bitmap).toMatchObject({ width: plain.bitmap.width, height: plain.bitmap.height })
  expect(alpha(detailed.bitmap)).toEqual(alpha(plain.bitmap))
  expect(detailed.bitmap.rgba).not.toEqual(plain.bitmap.rgba)
  expect(jetty(true)).toBe(detailed)
  expect(MOORING).toEqual({ u: JETTY.u + 1.5, v: JETTY.v + 0.82 })
})

it("grades the Terracotta texture without changing alpha or moving the workshop piers", () => {
  expect(jettyTimberGrade).toHaveLength(20)
  expect(jettyTimberGrade.slice(-5)).toEqual([0, 0, 0, 1, 0])
  for (const style of ["terracotta", "woodland"] as const) {
    const preview = (detailed: boolean) =>
      buildBayScene(bayTerrain([], style, detailed), style, 3, {
        assets: worldArtAssets,
        view: "harbor",
      }).drawables.find((d) => d.key === "bay-jetty")!
    const plain = preview(false)
    const finished = preview(true)
    expect(place(finished)).toEqual(place(plain))
    expect(plain.artColorMatrix).toBeUndefined()
    if (style === "terracotta") {
      expect(finished.artColorMatrix).toBe(jettyTimberGrade)
      expect(finished.artAsset).toBe(worldArtAssets.jetty)
    } else {
      expect(finished.artColorMatrix).toBeUndefined()
      expect(finished.artAsset).toBeUndefined()
    }
  }
})

it("paints the limestone lantern in place without moving or lighting up other pixels", () => {
  const lamp = (detailed: boolean) =>
    itemDrawable(bayFrame, bayTerrain([], "terracotta", detailed), "reward", "stone-lantern", 4, 5)!
  const plain = lamp(false)
  const lit = lamp(true)
  expect(place(lit)).toEqual(place(plain))
  expect(lit.foliage).toBeUndefined()
  if (lit.source.type !== "art" || plain.source.type !== "art")
    throw new Error("Missing lantern art")
  const mask = (rows: readonly string[]) => rows.map((row) => row.replace(/[^.]/g, "#"))
  expect(mask(lit.source.art.pixels)).toEqual(mask(plain.source.art.pixels))
  expect(lit.source.art.palette).not.toEqual(plain.source.art.palette)
})

it("keeps the pond deck shape while painting seams, board edges and pegs", () => {
  const map = tileMapFromRows([".dd.", "wwww"])
  const frame = mapFrame(map.cols, map.rows)
  const ordinary = paintGround(map, frame)
  const detailed = paintGround({ ...map, art: "detailed" }, frame)
  expect(alpha(detailed)).toEqual(alpha(ordinary))
  expect(detailed.rgba).not.toEqual(ordinary.rgba)
  expect(harborBoardColor(0, 0.5, 0.06)).toBe(harborTimber.shade)
  expect(harborBoardColor(0, 0.5, 0.2)).toBe(harborTimber.edge)
  expect(harborBoardColor(0, 0.96, 0.55)).toBe(harborTimber.dark)
})

import { buoy, islandSign, jetty, JETTY, MOORING, rowboat, rowboatFront } from "./archipelagoProps"
import { bayFrame, bayTerrain, buildBayScene } from "./bayWorkshop"
import { rgb, type Bitmap } from "./bitmap"
import {
  harborBoardColor,
  harborJettyBoardColor,
  harborTimber,
  jettyTimberGrade,
} from "./harborArt"
import { paintGround } from "./paint"
import { mapFrame } from "./projection"
import type { Sprite } from "./props"
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

function materialChanges(plain: Sprite, detailed: Sprite) {
  expect(detailed).toMatchObject({ anchorX: plain.anchorX, anchorY: plain.anchorY })
  const { width, height, rgba } = plain.bitmap
  expect(detailed.bitmap).toMatchObject({ width, height })
  expect(alpha(detailed.bitmap)).toEqual(alpha(plain.bitmap))
  const pixels = []
  for (let i = 0; i < rgba.length; i += 4) {
    const old = rgba.subarray(i, i + 3)
    const next = detailed.bitmap.rgba.subarray(i, i + 3)
    if (old.some((channel, n) => channel !== next[n])) {
      pixels.push({ x: (i / 4) % width, y: Math.floor(i / 4 / width), rgb: [...old].join(",") })
    }
  }
  expect(pixels.length).toBeGreaterThan(0)
  return pixels
}

it("changes dry hull wood across all strokes and both layers without changing their anchors or alpha", () => {
  const timber = new Set(["#7a5538", "#c8a06c"].map((tone) => rgb(tone).join(",")))
  for (const make of [rowboat, rowboatFront])
    for (const heading of ["se", "sw", "ne", "nw"] as const)
      for (const frame of [0, 1] as const) {
        const changed = materialChanges(make(frame, heading), make(frame, heading, true))
        expect(changed.every((pixel) => timber.has(pixel.rgb))).toBe(true)
      }
})

it("keeps both buoy lights, the waterline, letters, and the active flag untouched", () => {
  for (const frame of [0, 1] as const) {
    const paint = materialChanges(buoy(frame), buoy(frame, true))
    expect(paint.every(({ x, y }) => x >= 3 && x <= 7 && y >= 3 - frame && y <= 11 - frame)).toBe(
      true,
    )
  }
  for (const here of [false, true]) {
    const paint = materialChanges(
      islandSign("Fern landing", here),
      islandSign("Fern landing", here, true),
    )
    expect(paint.every(({ y }) => y === (here ? 8 : 1))).toBe(true)
  }
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

it("keeps the shorter limestone lantern static and rooted on the original plinth", () => {
  const lamp = (detailed: boolean) =>
    itemDrawable(bayFrame, bayTerrain([], "terracotta", detailed), "reward", "stone-lantern", 4, 5)!
  const plain = lamp(false)
  const lit = lamp(true)
  expect(place(lit)).toEqual({ ...place(plain), top: plain.y + 15 })
  expect(lit.foliage).toBeUndefined()
  if (lit.source.type !== "art" || plain.source.type !== "art")
    throw new Error("Missing lantern art")
  const mask = (rows: readonly string[]) => rows.map((row) => row.replace(/[^.]/g, "#"))
  const { pixels: rows, palette } = lit.source.art
  expect(mask(rows).slice(27)).toEqual(mask(plain.source.art.pixels).slice(27))
  expect(rows.slice(15, 30).every((row) => /[^.]/.test(row))).toBe(true)
  const glass = rows.slice(20, 23).join("")
  expect([...glass].some((pixel) => palette[pixel] === "#fff3bc")).toBe(true)
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
  expect(harborJettyBoardColor(0, 0.96, 0.55)).toBe(harborBoardColor(0, 0.96, 0.55))
  expect(harborJettyBoardColor(0, 0.5, 0.06)).toBe(harborBoardColor(0, 0.5, 0.06))
  expect(harborJettyBoardColor(0, 0.5, 0.9)).not.toBe(harborBoardColor(0, 0.5, 0.9))
})

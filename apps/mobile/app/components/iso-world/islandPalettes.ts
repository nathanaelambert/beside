// Each island in an archipelago gets its own look, so they read as different places rather than
// copies: a grass tone and a picnic-blanket colour. The terrain painter only uses exact palette
// colours, so a variant is a straight colour swap over the painted bitmaps.

import { createBitmap, rgb, type Bitmap } from "./bitmap"
import { palette } from "./paint"
import type { Drawable } from "./scene"

type Swap = Record<string, string>

const tones = (from: readonly string[], to: readonly string[]): Swap =>
  Object.fromEntries(from.map((color, i) => [color, to[i]!]))

export interface IslandPalette {
  name: string
  swap: Swap
}

/** Variant 0 is the original meadow with its rose gingham. */
export const islandPalettes: IslandPalette[] = [
  { name: "meadow", swap: {} },
  {
    // Late summer: warmer, drier grass and a blue gingham.
    name: "harvest",
    swap: {
      ...tones(palette.grass, ["#6a7d3b", "#7b8f43", "#8ea04b", "#a2b15a", "#b8c26d"]),
      [palette.grassLight]: "#d6d690",
      ...tones(palette.forest, ["#3d5a31", "#476836", "#52763d", "#5e8445"]),
      ...tones(palette.blanket, ["#2f4f7a", "#4f74a8", "#8fb0d6", "#f5e6cf"]),
    },
  },
  {
    // Cool and lush: bluer greens and a mustard gingham.
    name: "fern",
    swap: {
      ...tones(palette.grass, ["#447a4a", "#4f8954", "#5b985d", "#6ca86a", "#82ba79"]),
      [palette.grassLight]: "#b4dc9a",
      ...tones(palette.forest, ["#2c5636", "#33623d", "#3c7044", "#467e4c"]),
      ...tones(palette.blanket, ["#8a6a1f", "#c99a36", "#f2c96b", "#f5e6cf"]),
    },
  },
  {
    // Spring blossom: fresh greens and a plum gingham.
    name: "blossom",
    swap: {
      ...tones(palette.grass, ["#5a8a43", "#69994c", "#78a856", "#8bb862", "#a2c972"]),
      ...tones(palette.blanket, ["#4f2a44", "#874a72", "#c890b0", "#f5e6cf"]),
    },
  },
]

function hashId(id: string) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

/**
 * A palette per home base, given in membership order. The first (your oldest home base) keeps
 * the original meadow, so joining a second one never changes how yours looks. The others hash
 * to a preferred variant so each keeps its look, and clashes move to the next free one.
 */
export function assignIslandPalettes(ids: readonly string[]): Record<string, number> {
  const taken = new Set<number>([0])
  const result: Record<string, number> = {}
  ids.forEach((id, index) => {
    if (index === 0) {
      result[id] = 0
      return
    }
    const others = islandPalettes.length - 1
    let variant = 1 + (hashId(id) % others)
    for (let i = 0; i < others && taken.has(variant); i++) variant = 1 + (variant % others)
    if (taken.size <= others) taken.add(variant)
    result[id] = variant
  })
  return result
}

const swapRgb = new Map<number, Map<number, readonly [number, number, number]>>()
function rgbSwap(variant: number) {
  let table = swapRgb.get(variant)
  if (!table) {
    table = new Map()
    for (const [from, to] of Object.entries(islandPalettes[variant]?.swap ?? {})) {
      const [r, g, b] = rgb(from)
      table.set((r << 16) | (g << 8) | b, rgb(to))
    }
    swapRgb.set(variant, table)
  }
  return table
}

const recolored = new Map<number, WeakMap<Bitmap, Bitmap>>()
/** The bitmap with this variant's colours swapped in. Cached; variant 0 returns the original. */
export function recolor(bitmap: Bitmap, variant: number): Bitmap {
  if (!variant) return bitmap
  let cache = recolored.get(variant)
  if (!cache) recolored.set(variant, (cache = new WeakMap()))
  const hit = cache.get(bitmap)
  if (hit) return hit
  const table = rgbSwap(variant)
  const out = createBitmap(bitmap.width, bitmap.height)
  out.rgba.set(bitmap.rgba)
  for (let i = 0; i < out.rgba.length; i += 4) {
    if (!out.rgba[i + 3]) continue
    const to = table.get((out.rgba[i]! << 16) | (out.rgba[i + 1]! << 8) | out.rgba[i + 2]!)
    if (!to) continue
    out.rgba[i] = to[0]
    out.rgba[i + 1] = to[1]
    out.rgba[i + 2] = to[2]
  }
  cache.set(bitmap, out)
  return out
}

/** Raised terrain blocks carry the same grass and forest colours as the ground. */
export function recolorTerrain(drawables: Drawable[], variant: number): Drawable[] {
  if (!variant) return drawables
  return drawables.map((d) =>
    d.key.startsWith("block-") && d.source.type === "bitmap"
      ? { ...d, source: { type: "bitmap", bitmap: recolor(d.source.bitmap, variant) } }
      : d,
  )
}

import type { PixelArt } from "@beside/rewards"

const accents = [
  ["#c7984b", "#ffe29a"],
  ["#7b86a8", "#ceddfa"],
  ["#8c6391", "#f2b2cc"],
  ["#559278", "#cbebad"],
] as const
const variants = new WeakMap<PixelArt, Map<number, PixelArt>>()

/** Add small ground accents while preserving the item and its anchor. */
export function upgradedRewardArt(art: PixelArt, upgradeCount = 0): PixelArt {
  if (!upgradeCount) return art
  const accent = (upgradeCount - 1) % accents.length
  const paired = upgradeCount > 1
  const key = accent + (paired ? accents.length : 0)
  let cached = variants.get(art)
  if (!cached) variants.set(art, (cached = new Map()))
  const existing = cached.get(key)
  if (existing) return existing

  const [shade, light] = accents[accent]!
  const pixels = art.pixels.map((row) => [...row])
  const positions = paired ? [5, 26] : [5]
  for (const x of positions) {
    for (const [dx, dy, color] of [
      [0, -1, "+"],
      [-1, 0, "-"],
      [0, 0, "+"],
      [1, 0, "-"],
      [0, 1, "-"],
      [1, 2, "-"],
    ] as const) {
      const row = pixels[27 + dy]
      if (row?.[x + dx] === ".") row[x + dx] = color
    }
  }
  const upgraded: PixelArt = {
    ...art,
    palette: { ...art.palette, "+": light, "-": shade },
    pixels: pixels.map((row) => row.join("")),
  }
  cached.set(key, upgraded)
  return upgraded
}

import { createBitmap, hash, isSet, noise, put, rgb, type Bitmap } from "./bitmap"

/** Low-contrast olive beds; the flowers and the sunlit tree crowns stay brightest. */
export const meadowRamps = {
  grass: ["#698343", "#738d47", "#7d984d", "#86a153", "#8faa58"],
  forest: ["#3e5836", "#48643a", "#506f3e", "#5d7943"],
} as const

const blades = [
  ["....+", "+..+.", ".+.+.", ".xxx."],
  ["..+..", "+.+..", ".++..", ".xxx."],
  ["...+.", "+..+.", ".++.+", ".xxx."],
] as const

/** Tufts are painted on the existing top face, not placed as objects. */
export function meadowSurfaceColor(x: number, y: number, forest: boolean, rim: boolean) {
  const tones: readonly string[] = forest ? meadowRamps.forest : meadowRamps.grass
  const broad = noise(x + y * 0.45, y, 38, 81)
  const local = noise(x, y, 8, 148)
  const patch = 0.48 + (broad - 0.5) * 0.42 + (local - 0.5) * 0.38
  const last = tones.length - 1
  const bed = Math.min(last, Math.floor(patch * tones.length))
  if (rim) return tones[Math.min(last, bed + 1)]!

  // Stagger and jitter these little groups in ground coordinates, across tile seams.
  const row = Math.floor(y / 8)
  const staggered = x + (row % 2) * 6
  const col = Math.floor(staggered / 13)
  const seed = hash(col, row, 112)
  if (seed < (forest ? 0.29 : 0.44)) return tones[bed]!
  const dx = staggered - col * 13 - 1 - Math.floor(hash(col, row, 113) * 7)
  const dy = y - row * 8 - 1 - Math.floor(hash(col, row, 114) * 3)
  const stroke = blades[Math.floor(seed * blades.length)]?.[dy]?.[dx]
  if (stroke === "+") return tones[Math.min(last, bed + (seed > 0.7 && !forest ? 2 : 1))]!
  if (stroke === "x") return tones[Math.max(0, bed - 1)]!
  return tones[bed]!
}

const foliage = [
  "#303c2b",
  "#3c502f",
  "#4b6238",
  "#637740",
  "#7e904b",
  "#a0aa5d",
  "#bac275",
] as const
const outline = rgb("#253f28")
const ochrePetal = rgb("#f2c96b")
const palePetal = rgb("#f6f1e1")
const shrubCache = new WeakMap<Bitmap, Bitmap>()

// Tiny overlapping leaf clusters share the oak's olive highlights and upper-left light.
const leafClusters = [
  [5, 6, 0],
  [9, 4, 1],
  [13, 5, 0],
  [16, 8, -1],
  [5, 10, -1],
  [8, 8, 0],
  [12, 8, 0],
  [14, 11, -2],
  [9, 12, -2],
] as const

/** Repaint the existing shrub without touching its silhouette or contact with the ground. */
export function meadowShrub(source: Bitmap): Bitmap {
  const cached = shrubCache.get(source)
  if (cached) return cached
  const sprite = createBitmap(source.width, source.height)
  sprite.rgba.set(source.rgba)
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (!isSet(source, x, y)) continue
      const i = (y * source.width + x) * 4
      const matches = (color: readonly number[]) =>
        color.every((c, channel) => source.rgba[i + channel] === c)
      if (matches(outline) || matches(ochrePetal) || matches(palePetal)) {
        // Keep the old contour and flowering accents in the same pixels.
        put(
          sprite,
          x,
          y,
          matches(outline) ? foliage[0] : matches(ochrePetal) ? "#d8a65e" : "#e3b18a",
        )
        continue
      }
      // Small asymmetric groups, not concentric shading across the whole bush.
      let light = y >= source.height - 4 ? 1 : 2
      let nearest = 4
      for (const [cx, cy, tier] of leafClusters) {
        const u = x - cx
        const v = y - cy
        const distance = Math.abs(u + v * 0.3) + Math.abs(v) * 1.25
        if (distance >= nearest) continue
        nearest = distance
        const facing = -u * 0.65 - v * 1.45
        const leaf = facing > 1.7 ? 5 : facing > 0.2 ? 4 : facing > -1.8 ? 3 : 2
        light = Math.max(1, leaf + tier)
      }
      put(sprite, x, y, foliage[light]!)
    }
  }
  shrubCache.set(source, sprite)
  return sprite
}

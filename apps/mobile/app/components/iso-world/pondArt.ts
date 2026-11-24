import { noise, type Rgb } from "./bitmap"

export type PondBounds = { x: number; y: number; width: number; height: number }

/** Keep the outermost waterline intact; all other accents stay on its wet side. */
export const pondBankClearance = 0.095
export const pondGlintColor = "#7fa99a"

const clampUnit = (x: number) => Math.max(0, Math.min(1, x))
function blend(a: Rgb, b: Rgb, weight: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * weight),
    Math.round(a[1] + (b[1] - a[1]) * weight),
    Math.round(a[2] + (b[2] - a[2]) * weight),
  ]
}

const underShade: Rgb = [27, 61, 62]
const openPool: Rgb = [43, 85, 79]
const shallows: Rgb = [55, 106, 96]
const reflectedSky: Rgb = [112, 157, 144]

type Mark = {
  /** Center relative to the basin bounds; the artwork itself is in logical pixels. */
  u: number
  v: number
  rows: readonly string[]
}

const stoneTones: Record<string, Rgb> = {
  a: [42, 72, 68],
  b: [68, 103, 86],
  c: [95, 119, 89],
}
const stones: readonly Mark[] = [
  { u: 0.25, v: 0.25, rows: ["..bccb...", ".bcccabaa", ".bbaabcca", "..a..abba"] },
  { u: 0.7125, v: 0.365, rows: ["...bccb..", "abbccb...", "bcaab..ca", "aa....ab."] },
]

const leafTones: Record<string, Rgb> = {
  a: [38, 72, 60],
  b: [65, 103, 64],
  c: [88, 124, 67],
  d: [109, 139, 70],
}
const leaves: readonly Mark[] = [
  { u: 0.394, v: 0.296, rows: [".ddc..", "dcc.ba", "bccbba", ".abbaa"] },
  { u: 0.4625, v: 0.346, rows: [".cc.", "cb.a", ".aba"] },
]

function markAt(
  u: number,
  v: number,
  bounds: PondBounds,
  marks: readonly Mark[],
  palette: Record<string, Rgb>,
) {
  for (const mark of marks) {
    const y = Math.floor((v - mark.v) * bounds.height + mark.rows.length / 2)
    const row = mark.rows[y]
    if (!row) continue
    const x = Math.floor((u - mark.u) * bounds.width + row.length / 2)
    const tone = palette[row[x] ?? "."]
    if (tone) return tone
  }
  return undefined
}

const reflections = [
  { u: 0.288, v: 0.196, span: 7.8, strength: 0.36 },
  { u: 0.6625, v: 0.523, span: 6.1, strength: 0.3 },
] as const

/** Two short broken groups, with at most one faint echo per group. */
export function pondReflection(u: number, v: number, { width, height }: PondBounds) {
  for (const mark of reflections) {
    const t = ((u - mark.u) * width) / Math.min(mark.span, width * 0.21)
    const dy = (v - mark.v) * height
    if (t > -0.5 && t < -0.08 && dy >= 0 && dy < 0.68) return mark.strength
    if (t > 0.06 && t < 0.46 && dy >= 1 / 3 && dy < 1) return mark.strength * 0.8
    if (t > -0.2 && t < 0.11 && dy >= 1.65 && dy < 2.2) return mark.strength * 0.48
  }
  return 0
}

/** Shaded water, submerged stone, reflected sky, and two fixed leaves. */
export function quietPondColor(
  x: number,
  y: number,
  bank: number,
  bounds: PondBounds,
  base: Rgb,
): Rgb {
  if (bank <= pondBankClearance) return base
  const u = (x - bounds.x) / bounds.width
  const v = (y - bounds.y) / bounds.height
  // Across-bank light rather than concentric depths. Quantize wide quiet
  // planes, not individual pixels, to retain the pixel-art material.
  const swell = (noise(x, y, 18, 144) - 0.5) * 0.2
  const light = clampUnit(0.21 + u * 0.56 + v * 0.24 + swell)
  const body = blend(underShade, openPool, Math.floor(light * 6) / 6)
  const shoal = clampUnit((0.56 - bank + swell * 0.67) / 0.59)
  const bankShadow = clampUnit((0.46 - (v + u * 0.28)) / 0.42)
  let color = blend(body, shallows, shoal * (1 - 0.65 * bankShadow))
  if (bank < 0.8) {
    const stone = markAt(u, v, bounds, stones, stoneTones)
    if (stone) color = blend(color, stone, 0.73)
  }
  color = blend(color, reflectedSky, pondReflection(u, v, bounds))
  if (bank > 0.27) {
    const leaf = markAt(u, v, bounds, leaves, leafTones)
    if (leaf) color = leaf
  }
  return blend(base, color, clampUnit((bank - pondBankClearance) / 0.24))
}

import { hash, noise, rgb, type Rgb } from "./bitmap"
import { CELL } from "./projection"

const drySand = ["#c8b48b", "#d3be94", "#dcc9a1", "#e2d1aa"] as const
const matteSand = ["#c6b28c", "#d0bf99", "#d7c6a0", "#ddcba3"] as const
const creamFaces: readonly Rgb[] = [
  [211, 190, 155],
  [218, 199, 165],
  [203, 181, 144],
  [207, 190, 159],
  [224, 204, 169],
]
const lengths = [6, 10, 8, 12, 6, 9, 7] as const
const runLength = lengths.reduce<number>((sum, length) => sum + length, 0)
const courseWidth = 7
const lowerFace: Rgb = [195, 170, 134]
const shadowJoint: Rgb = [165, 138, 104]
const warmJoint: Rgb = [174, 151, 118]
const rimBlend = 0.48

// Keep the placement and variation of the approved storybook swatch.
const coursePattern = (column: number, course: number) =>
  ((Math.imul(column + 19, 198491317) ^ Math.imul(course + 113, 6542989)) >>> 0) % 997

/** Broad staggered limestone faces, laid in world space across tile boundaries. */
export function stonePathColor(u: number, v: number, x: number, y: number, edge: boolean): Rgb {
  const cross = v * CELL
  const course = Math.floor(cross / courseWidth)
  const lateral = cross - course * courseWidth
  const run = u * CELL + (course % 2 ? 4.4 : 0) + (coursePattern(course, 31) % 6)
  const repeat = Math.floor(run / runLength)
  let distance = run - repeat * runLength
  let column = 0
  while (column < lengths.length - 1 && distance >= lengths[column]!) {
    distance -= lengths[column]!
    column++
  }
  const tail = lengths[column]! - distance
  const variation = coursePattern(column + repeat * lengths.length, course)
  const chamfer =
    (lateral < 2 && distance < 1.7 && variation % 3 === 1) ||
    (lateral > 5.3 && tail < 1.7 && variation % 4 === 2)
  const isJoint = distance < 0.88 || lateral < 0.81 || chamfer
  const tone = isJoint
    ? variation % 3 === 1
      ? shadowJoint
      : warmJoint
    : tail < 1.25 || lateral > 6.12
      ? lowerFace
      : creamFaces[variation % creamFaces.length]!
  if (!edge) return tone

  const [r, g, b] = rgb(wornEdgeColor(u, v, x, y))
  return [
    Math.round(r + (tone[0] - r) * rimBlend),
    Math.round(g + (tone[1] - g) * rimBlend),
    Math.round(b + (tone[2] - b) * rimBlend),
  ]
}

// Keep the old weathering where the new stone meets grass or sand.
const wornStone = ["#bea17a", "#c4aa83", "#ceb48b", "#bfaa88"] as const

function wornEdgeColor(u: number, v: number, x: number, y: number) {
  const chip = noise(x, y, 6, 215)
  const courses = 2.5 * v + (chip - 0.5) * 0.3
  const row = Math.floor(courses)
  const across = courses - row
  const run = 2.85 * u + row * 0.46 + (noise(x + y / 3, y, 9, 163) - 0.5) * 0.38
  const column = Math.floor(run)
  const along = run - column
  const joint = along < 0.09 || across < 0.08
  const corner = Math.abs(along - 0.53) + Math.abs(across - 0.53)
  const variation = hash(column, row, 135)
  if (joint || corner > 0.86) return chip > 0.59 ? "#ac9672" : "#9b835e"
  if (along > 0.91 || across > 0.91) return "#ad936c"
  if ((along < 0.19 || across < 0.21) && chip > 0.3) return "#ddc7a0"
  if (chip < 0.26 && along > 0.35 && across > 0.48) return "#b6a17f"
  return wornStone[Math.floor(variation * wornStone.length)]!
}

/** A matte dry surface, with the original wet belt preserved at the water. */
export function pondSandColor(x: number, y: number, waterDistance: number, matte = false) {
  const ripple = noise(x + y * 0.85, y, 9, 262)
  const wet = waterDistance + (ripple - 0.5) * 0.16
  if (wet < 0.095) return ripple > 0.55 ? "#b8a889" : "#ab9b7c"
  if (wet < 0.245) return ripple > 0.43 ? "#c6b591" : "#bdab86"
  if (!matte) {
    const grain = hash(x, y, 265)
    const ridge = Math.floor(y + x * 0.21 + ripple * 2) % 6 === 0
    if (ridge && grain > 0.4) return "#e7d5ab"
    if (grain > 0.964) return "#c3ae85"
    return drySand[Math.floor((0.43 * noise(x, y, 15, 267) + 0.57 * ripple) * drySand.length)]!
  }
  const base = 0.68 * noise(x, y, 15, 267) + 0.32 * ripple
  const bed = Math.floor(base * matteSand.length)
  // Short drifts sit in a few patches, with no stripe crossing an entire bank.
  const row = Math.floor(y / 6)
  const drift = x + (row % 2) * 4
  const col = Math.floor(drift / 9)
  const group = hash(col, row, 265)
  const along = drift - col * 9 - Math.floor(group * 3)
  const across = y - row * 6 - 1 - Math.floor(hash(col, row, 266) * 3)
  if (group > 0.55 && along >= 1 && along < 5 && across === (along > 2 ? 1 : 0)) {
    return matteSand[Math.min(matteSand.length - 1, bed + 1)]!
  }
  if (group < 0.2 && across === 2 && along >= 2 && along < 4)
    return matteSand[Math.max(0, bed - 1)]!
  return matteSand[bed]!
}

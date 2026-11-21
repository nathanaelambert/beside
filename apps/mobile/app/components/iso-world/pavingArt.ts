import { hash, noise } from "./bitmap"

const flagstone = ["#bea17a", "#c4aa83", "#ceb48b", "#bfaa88"] as const
const drySand = ["#c8b48b", "#d3be94", "#dcc9a1", "#e2d1aa"] as const

/** Staggered limestone flags in world coordinates, continuous across the tile grid. */
export function stonePathColor(u: number, v: number, x: number, y: number) {
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
  return flagstone[Math.floor(variation * flagstone.length)]!
}

/** Fine sand ripples, with an uneven darker belt only where sand borders water. */
export function pondSandColor(x: number, y: number, waterDistance: number) {
  const ripple = noise(x + y * 0.85, y, 9, 262)
  const grain = hash(x, y, 265)
  const wet = waterDistance + (ripple - 0.5) * 0.16
  if (wet < 0.095) return ripple > 0.55 ? "#b8a889" : "#ab9b7c"
  if (wet < 0.245) return ripple > 0.43 ? "#c6b591" : "#bdab86"
  const base = 0.43 * noise(x, y, 15, 267) + 0.57 * ripple
  // Broken ridges are flatter than the flagstones, with sparse darker grains.
  const ridge = Math.floor(y + x * 0.21 + ripple * 2) % 6 === 0
  if (ridge && grain > 0.4) return "#e7d5ab"
  if (grain > 0.964) return "#c3ae85"
  return drySand[Math.floor(base * drySand.length)]!
}

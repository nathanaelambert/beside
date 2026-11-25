import type { CottageSpriteLevel } from "@beside/api-client"

import { createBitmap, outline } from "./bitmap"
import { HALF_H, HALF_W } from "./projection"
import { fillPolygon, roofColors, type Point, type RoofColor, type Sprite } from "./props"

const cache = new Map<string, Sprite>()

// Shared footprint for foundation, open timber framing, roof & entrance, and finished.
export function bayCottageArt(roof: RoofColor, stage: CottageSpriteLevel, lit = true): Sprite {
  const key = `${roof}:${stage}:${lit}`
  const cached = cache.get(key)
  if (cached) return cached

  const bitmap = createBitmap(64, 70)
  const ax = 32
  const ay = 60
  const p = (u: number, v: number, h: number): Point => [
    ax + (u - v) * HALF_W,
    ay + (u + v) * HALF_H - h,
  ]
  const paint = (points: Point[], color: string | ((x: number, y: number) => string)) =>
    fillPolygon(bitmap, points, typeof color === "string" ? () => color : color)
  const top = (l: number, r: number, b: number, f: number, h: number) => [
    p(l, f, h),
    p(r, f, h),
    p(r, b, h),
    p(l, b, h),
  ]
  const front = (l: number, r: number, v: number, lo: number, hi: number) => [
    p(l, v, lo),
    p(r, v, lo),
    p(r, v, hi),
    p(l, v, hi),
  ]
  const side = (u: number, b: number, f: number, lo: number, hi: number) => [
    p(u, f, lo),
    p(u, b, lo),
    p(u, b, hi),
    p(u, f, hi),
  ]
  const [l, r, b, f] = [-0.53, 0.53, -0.4, 0.4]
  const stoneTop = "#d3bc91"
  const timber = "#99613c"
  const woodLit = "#dca66c"
  const woodDark = "#60412f"

  paint(front(l, r, f, 0, 4), (x, y) => ((x + Math.floor(y / 2)) % 6 === 0 ? "#665b54" : "#948474"))
  paint(side(r, b, f, 0, 4), (x, y) => ((x + Math.floor(y / 2)) % 5 === 0 ? "#554b48" : "#796961"))
  paint(top(l, r, b, f, 4), (x, y) => ((x + 2 * y) % 7 === 0 ? "#b29776" : stoneTop))

  if (stage === 0) {
    // Two stacks of sawn beams on the marked-out stone base.
    paint(top(-0.4, 0.02, 0.03, 0.18, 6), woodLit)
    paint(front(-0.4, 0.02, 0.18, 4, 6), timber)
    paint(top(-0.31, 0.32, -0.18, -0.08, 5), timber)
  } else if (stage === 1) {
    // Read the structure as construction: open bays and rafters, not a completed roof.
    const post = (u: number, v: number) => {
      paint(front(u - 0.055, u + 0.045, v + 0.05, 4, 21), woodLit)
      paint(side(u + 0.045, v - 0.05, v + 0.05, 4, 21), woodDark)
    }
    const rail = (v: number) => {
      paint(front(l, r, v, 19, 22), timber)
      paint(top(l, r, v - 0.06, v, 22), woodLit)
    }
    paint(top(l + 0.03, r - 0.03, b + 0.05, f - 0.05, 5), (x, y) =>
      (x + 2 * y) % 6 === 0 ? woodDark : "#bb8856",
    )
    post(l + 0.05, b)
    post(r - 0.03, b)
    rail(b + 0.05)
    for (const u of [l + 0.05, 0, r - 0.03]) paint(side(u, b, f, 19, 21), timber)
    post(l + 0.06, f - 0.06)
    post(r - 0.06, f - 0.06)
    rail(f)
    paint([p(l + 0.06, f, 6), p(l + 0.15, f, 6), p(r - 0.06, f, 19), p(r - 0.15, f, 19)], timber)
  } else {
    const colors = roofColors[roof]
    const isLodge = roof === "teal"
    const lightWall = isLodge ? "#ca9560" : "#f2deaf"
    const shadeWall = isLodge ? "#9e6846" : "#ceae83"
    const finishing = stage === 3
    paint(front(l, r, f, 4, 21), (x, y) =>
      isLodge && (x - 2 * y) % 6 === 0 ? "#b17a50" : lightWall,
    )
    paint([p(r, f, 4), p(r, b, 4), p(r, b, 21), p(r, 0, 33), p(r, f, 21)], shadeWall)
    paint(front(-0.28, 0.12, f + 0.01, 4, 16), "#5e4034")
    paint(front(-0.2, 0.065, f + 0.02, 4, 14.7), (x) => (x % 3 === 0 ? "#9a5b37" : "#ad7549"))
    paint(front(0.015, 0.07, f + 0.03, 8, 10), "#e9bf70")
    paint(top(-0.3, 0.14, f, 0.59, 2), "#ada18b")
    paint(side(r + 0.008, -0.22, 0.23, 9, 18), "#604638")
    paint(side(r + 0.016, -0.14, 0.15, 10, 17), lit ? "#efc772" : "#82a1a5")
    paint(side(r + 0.024, -0.028, 0.04, 10, 17), lit ? "#936841" : "#52656b")
    if (finishing) {
      paint(side(r + 0.02, 0.18, 0.31, 9, 18), "#556957")
      paint(side(r + 0.025, -0.33, -0.22, 9, 18), "#4a6551")
      paint(side(r + 0.035, -0.24, 0.24, 7, 9), "#81503d")
      paint(side(r + 0.04, -0.18, 0.18, 9, 10.5), "#b76963")
    }
    const span = f + 0.07
    const eave = 19
    const ridge = 33
    const lr = l - 0.08
    const rr = r + 0.08
    paint([p(lr, 0, ridge), p(rr, 0, ridge), p(rr, -span, eave), p(lr, -span, eave)], colors[0])
    paint([p(lr, span, eave), p(rr, span, eave), p(rr, 0, ridge), p(lr, 0, ridge)], (x, y) => {
      const course = Math.floor((y - ay - (x - ax) / 2 + ridge) / 3)
      const seam = (x + course * 3) % 6 === 0
      if (course <= 0) return colors[4]
      if (seam) return colors[1]
      return course % 3 === 2 ? colors[3] : colors[2]
    })
    if (finishing) {
      paint(front(-0.28, -0.06, -0.05, 29, 38), "#a88063")
      paint(side(-0.06, -0.2, -0.05, 29, 38), "#79614f")
      paint(top(-0.31, -0.03, -0.22, -0.03, 38), "#c69879")
    }
  }

  outline(bitmap, "#3b2a2e")
  const result = { bitmap, anchorX: ax, anchorY: ay }
  cache.set(key, result)
  return result
}

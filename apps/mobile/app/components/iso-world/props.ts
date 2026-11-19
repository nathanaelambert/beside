// Procedural pixel-art props for the iso world: timber-framed houses (one per activity),
// bushes and rocks. Each returns a bitmap plus the pixel that sits on the ground anchor.

import { createBitmap, hash, outline, put, type Bitmap } from "./bitmap"
import { HALF_H, HALF_W } from "./projection"

export interface Sprite {
  bitmap: Bitmap
  /** Pixel in the bitmap that rests on the world anchor (bottom centre of the footprint). */
  anchorX: number
  anchorY: number
}

export type Point = [number, number]

export function fillPolygon(
  bitmap: Bitmap,
  points: Point[],
  color: (x: number, y: number) => string,
) {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const minX = Math.floor(Math.min(...xs))
  const maxX = Math.ceil(Math.max(...xs))
  const minY = Math.floor(Math.min(...ys))
  const maxY = Math.ceil(Math.max(...ys))
  // Winding-agnostic convex test on pixel centres.
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5
      const py = y + 0.5
      let sign = 0
      let inside = true
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i]!
        const [bx, by] = points[(i + 1) % points.length]!
        const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax)
        if (cross === 0) continue
        const s = Math.sign(cross)
        if (sign === 0) sign = s
        else if (s !== sign) {
          inside = false
          break
        }
      }
      if (inside) put(bitmap, x, y, color(x, y))
    }
}

export const roofColors = {
  clay: ["#7e2f22", "#a8432a", "#c8573a", "#e07a4a", "#f0a06a"],
  teal: ["#24505a", "#2f6670", "#3f8088", "#5aa0a3", "#8cc4bd"],
  plum: ["#4f2a44", "#6a3a5a", "#874a72", "#a8668f", "#c890b0"],
  moss: ["#3c5229", "#4f6b36", "#62823f", "#7d9c4f", "#a3bf6e"],
  slate: ["#273c60", "#34507e", "#43659a", "#5b82b5", "#8fb0d6"],
} as const
export type RoofColor = keyof typeof roofColors
export const roofColorOrder: RoofColor[] = ["clay", "teal", "plum", "moss", "slate"]

const wall = { plaster: "#efe3c8", shade: "#d9c9a8", timber: "#6b4a33", base: "#9a9c96" }
const glass = { frame: "#4a3a33", pane: "#7fb0d0", light: "#d5ecf2", lit: "#f6d77a" }

/**
 * A small two-storey cottage seen from the iso camera: a front-left wall with door and
 * windows, a gabled right end, and a shingled roof whose ridge runs along u.
 * `lit` turns the windows warm, used when the activity has a session open now.
 */
export function house(roof: RoofColor = "clay", lit = false): Sprite {
  const W = 64
  const H = 66
  const bitmap = createBitmap(W, H)
  const ax = W / 2
  const ay = H - 6
  const P = (u: number, v: number, h: number): Point => [
    ax + (u - v) * HALF_W,
    ay + (u + v) * HALF_H - h,
  ]
  const u0 = -0.4
  const u1 = 0.4
  const v0 = -0.33
  const v1 = 0.33
  const wallH = 19
  const ridgeH = 14
  const o = 0.08
  const eave = wallH - 2
  const tones = roofColors[roof]

  // Back slope first, then walls, then the front slope over the eaves.
  fillPolygon(
    bitmap,
    [
      P(u0 - o, 0, wallH + ridgeH),
      P(u1 + o, 0, wallH + ridgeH),
      P(u1 + o, v0 - o, eave),
      P(u0 - o, v0 - o, eave),
    ],
    () => tones[1]!,
  )
  // Chimney on the back slope.
  fillPolygon(
    bitmap,
    [
      P(-0.2, -0.14, wallH + 6),
      P(-0.08, -0.14, wallH + 6),
      P(-0.08, -0.14, wallH + ridgeH + 5),
      P(-0.2, -0.14, wallH + ridgeH + 5),
    ],
    (x, y) => ((y + (x % 2)) % 3 === 0 ? "#7d4436" : "#a35e4b"),
  )
  fillPolygon(
    bitmap,
    [
      P(-0.08, -0.14, wallH + 6),
      P(-0.08, -0.26, wallH + 6),
      P(-0.08, -0.26, wallH + ridgeH + 5),
      P(-0.08, -0.14, wallH + ridgeH + 5),
    ],
    () => "#7d4436",
  )

  // Right (gable) wall: u = u1, from v1 back to v0, with a peaked top.
  fillPolygon(
    bitmap,
    [P(u1, v1, 0), P(u1, v0, 0), P(u1, v0, wallH), P(u1, 0, wallH + ridgeH - 1), P(u1, v1, wallH)],
    (x, y) => {
      const v = u1 - (x + 0.5 - ax) / HALF_W
      const h = ay + (u1 + v) * HALF_H - (y + 0.5)
      if (h < 2) return wall.base
      if (Math.abs(v - v0) < 0.05 || Math.abs(v - v1) < 0.05) return wall.timber
      if (Math.abs(h - wallH) < 0.9) return wall.timber
      // Round attic window in the gable.
      if (Math.hypot(v * 16, h - (wallH + 6)) < 2.8)
        return Math.hypot(v * 16, h - (wallH + 6)) < 1.6
          ? lit
            ? glass.lit
            : glass.pane
          : glass.frame
      // Ground-floor window.
      if (Math.abs(v - 0.02) < 0.13 && h > 6 && h < 13)
        return Math.abs(v - 0.02) > 0.09 || h < 7 || h > 12
          ? glass.frame
          : lit
            ? glass.lit
            : y % 3 === 0
              ? glass.light
              : glass.pane
      return wall.shade
    },
  )

  // Front-left wall: v = v1, from u0 to u1.
  fillPolygon(bitmap, [P(u0, v1, 0), P(u1, v1, 0), P(u1, v1, wallH), P(u0, v1, wallH)], (x, y) => {
    const u = (x + 0.5 - ax) / HALF_W + v1
    const h = ay + (u + v1) * HALF_H - (y + 0.5)
    const s = (u - u0) / (u1 - u0)
    if (h < 2) return wall.base
    if (s < 0.06 || s > 0.94 || Math.abs(s - 0.5) < 0.035) return wall.timber
    if (Math.abs(h - 10.5) < 0.6 && (s < 0.5 || s > 0.62)) return wall.timber
    // Door, right of the centre beam.
    if (s > 0.58 && s < 0.78 && h < 13) {
      if (s < 0.61 || s > 0.75 || h > 12) return "#4a2f1e"
      return s > 0.71 && h > 5.5 && h < 7 ? "#e7c66a" : "#83552f"
    }
    // Windows on each storey.
    for (const [ws, wh] of [
      [0.25, 6.2],
      [0.25, 14.6],
      [0.8, 14.6],
    ] as const) {
      if (Math.abs(s - ws) < 0.1 && Math.abs(h - wh) < 2.8) {
        if (Math.abs(s - ws) > 0.07 || Math.abs(h - wh) > 2.1) return glass.frame
        return lit ? glass.lit : y % 3 === 0 ? glass.light : glass.pane
      }
    }
    return wall.plaster
  })

  // Front slope, with shingle courses and staggered joints.
  const k = (ridgeH + 2) / (v1 + o)
  fillPolygon(
    bitmap,
    [
      P(u0 - o, v1 + o, eave),
      P(u1 + o, v1 + o, eave),
      P(u1 + o, 0, wallH + ridgeH),
      P(u0 - o, 0, wallH + ridgeH),
    ],
    (x, y) => {
      const px = x + 0.5 - ax
      const py = y + 0.5 - ay
      const v = (py - px / 2 + wallH + ridgeH) / (2 * HALF_H + k)
      const u = px / HALF_W + v
      const course = Math.floor(v * 16)
      const along = Math.floor((u + 1) * 12 + (course % 2) * 0.5)
      if (v < 0.035) return tones[4]!
      if (v * 16 - course < 0.22) return tones[1]!
      if (along % 3 === 0 && hash(along, course, 31) > 0.4) return tones[2]!
      return v > 0.25 ? tones[3]! : tones[2]!
    },
  )
  outline(bitmap, "#3b2a2e")
  return { bitmap, anchorX: ax, anchorY: ay }
}

/** A domed, top-lit bush cluster. */
export function bush(seed: number): Sprite {
  const W = 20
  const H = 14
  const bitmap = createBitmap(W, H)
  const tones = ["#2f5530", "#3f6c3b", "#558a4b", "#73a85c", "#9ccb73"]
  const blobs = [
    [7, 8, 5.2],
    [13, 8.5, 4.6],
    [10, 5.5, 4.4 + seed],
  ]
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let best = -1
      for (const [cx, cy, r] of blobs) {
        const nx = (x + 0.5 - cx!) / r!
        const ny = (y + 0.5 - cy!) / r!
        const d = Math.hypot(nx, ny)
        if (d >= 1) continue
        const lit = -nx * 0.5 - ny * 0.8 + Math.sqrt(1 - d * d) * 0.5
        best = Math.max(best, lit > 0.8 ? 4 : lit > 0.45 ? 3 : lit > 0.1 ? 2 : 1)
      }
      if (best > 0) put(bitmap, x, y, tones[best]!)
    }
  if (seed > 0.5) {
    put(bitmap, 6, 6, "#f2c96b")
    put(bitmap, 13, 7, "#f6f1e1")
  }
  outline(bitmap, "#253f28")
  return { bitmap, anchorX: W / 2, anchorY: H - 2 }
}

/** A lumpy grey boulder with a lit top, sitting in its own shadow. */
export function rock(seed: number): Sprite {
  const W = 18
  const H = 14
  const bitmap = createBitmap(W, H)
  const tones = ["#5d676d", "#78848a", "#97a3a7", "#bfc9c8"]
  const blobs = [
    [8, 8.5, 5.5],
    [11.5, 9.5, 4 + seed * 1.5],
  ]
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let best = -1
      for (const [cx, cy, r] of blobs) {
        const nx = (x + 0.5 - cx!) / r!
        const ny = (y + 0.5 - cy!) / (r! * 0.85)
        const d = Math.hypot(nx, ny)
        if (d >= 1) continue
        const lit = -nx * 0.45 - ny * 0.85 + Math.sqrt(1 - d * d) * 0.4
        best = Math.max(best, lit > 0.75 ? 3 : lit > 0.35 ? 2 : lit > -0.05 ? 1 : 0)
      }
      if (best >= 0) put(bitmap, x, y, tones[best]!)
    }
  if (seed > 0.4) {
    put(bitmap, 5, 6, "#7fa65a")
    put(bitmap, 6, 6, "#7fa65a")
    put(bitmap, 6, 5, "#9ccb73")
  }
  outline(bitmap, "#3b3f45")
  return { bitmap, anchorX: W / 2, anchorY: H - 2 }
}

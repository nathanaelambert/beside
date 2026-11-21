// Procedural pixel-art props for the iso world: timber-framed houses (one per activity),
// bushes and rocks. Each returns a bitmap plus the pixel that sits on the ground anchor.

import type { CottageSpriteLevel } from "@beside/api-client"

import { createBitmap, outline, put, type Bitmap } from "./bitmap"
import { shorelineBoulderColor } from "./coastArt"
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
 * Low, wide silhouettes read clearly at the island's default zoom. Roof colors also give
 * the timber lodge and clubhouse distinct profiles without changing any activity behavior.
 */
export function house(
  roof: RoofColor = "clay",
  lit = false,
  level: CottageSpriteLevel = 1,
): Sprite {
  const bitmap = createBitmap(64, 70)
  const ax = 32
  const ay = 60
  const P = (u: number, v: number, h: number): Point => [
    ax + (u - v) * HALF_W,
    ay + (u + v) * HALF_H - h,
  ]
  const lodge = roof === "teal"
  const club = roof === "slate"
  const u0 = -0.52
  const u1 = 0.52
  const v0 = -0.4
  const v1 = 0.4
  if (level === 0) {
    fillPolygon(bitmap, [P(u0, v1, 3), P(u1, v1, 3), P(u1, v0, 3), P(u0, v0, 3)], () => "#c0a57c")
    fillPolygon(bitmap, [P(u0, v1, 0), P(u1, v1, 0), P(u1, v1, 3), P(u0, v1, 3)], () => wall.base)
    fillPolygon(bitmap, [P(u1, v1, 0), P(u1, v0, 0), P(u1, v0, 3), P(u1, v1, 3)], () => "#777b73")
    fillPolygon(
      bitmap,
      [P(-0.37, 0.08, 4), P(0.13, 0.08, 4), P(0.13, -0.13, 4), P(-0.37, -0.13, 4)],
      () => wall.timber,
    )
    outline(bitmap, "#3b2a2e")
    return { bitmap, anchorX: ax, anchorY: ay }
  }
  const wallH = 19
  const ridgeH = 12
  const ridge = wallH + ridgeH
  const o = 0.09
  const eave = wallH - 2
  const tones = roofColors[roof]
  const pane = lit ? glass.lit : glass.pane

  fillPolygon(
    bitmap,
    [P(u0 - o, 0, ridge), P(u1 + o, 0, ridge), P(u1 + o, v0 - o, eave), P(u0 - o, v0 - o, eave)],
    () => tones[0],
  )

  // A single large window stands out on the shaded gable.
  fillPolygon(
    bitmap,
    [P(u1, v1, 0), P(u1, v0, 0), P(u1, v0, wallH), P(u1, 0, ridge - 1), P(u1, v1, wallH)],
    (x, y) => {
      const v = u1 - (x + 0.5 - ax) / HALF_W
      const h = ay + (u1 + v) * HALF_H - (y + 0.5)
      if (h < 2.5) return "#777b73"
      if (Math.abs(v) > 0.35 || Math.abs(h - wallH) < 1) return wall.timber
      if (level === 3 && !lodge && !club && Math.abs(v) < 0.26 && h > 2.5 && h < 7) {
        if (h < 4.5) return "#844b35"
        return Math.abs(v) < 0.09 ? "#edb25f" : "#426447"
      }
      if (Math.abs(v) < 0.27 && h > 5 && h < 15) {
        if (Math.abs(v) > 0.2 || h < 6.5 || h > 13.5) return glass.frame
        if (Math.abs(v) < 0.033) return wall.timber
        return h > 11.5 && !lit ? glass.light : pane
      }
      if (lodge) return Math.floor(h) % 5 === 0 ? "#774828" : "#aa6b3c"
      return "#c2a984"
    },
  )

  // One legible entrance instead of several narrow columns and windows.
  const doubleDoor = club && level >= 2
  const door = doubleDoor ? 0.28 : 0.2
  fillPolygon(bitmap, [P(u0, v1, 0), P(u1, v1, 0), P(u1, v1, wallH), P(u0, v1, wallH)], (x, y) => {
    const u = (x + 0.5 - ax) / HALF_W + v1
    const h = ay + (u + v1) * HALF_H - (y + 0.5)
    if (
      doubleDoor &&
      Math.abs(u + 0.07) < door + 0.08 &&
      h >= 2 &&
      h < 16 &&
      (Math.abs(u + 0.07) >= door || h >= 14)
    )
      return "#969586"
    if (Math.abs(u + 0.07) < door && h < 14) {
      if (h > 12 || Math.abs(u + 0.07) > door - 0.065) return "#442c24"
      if (doubleDoor && Math.abs(u + 0.07) < 0.04) return "#442c24"
      return u > 0.01 && u < 0.09 && h > 5 && h < 7 ? "#eac779" : "#8c5535"
    }
    if (h < 2.5) return wall.base
    if (Math.abs(u) > 0.45 || h > wallH - 2) return wall.timber
    if (lodge) return Math.floor(h) % 5 === 0 ? "#965332" : "#ce9156"
    return wall.plaster
  })

  // Broad roof planes with sparse courses remain distinct when zoomed out.
  const pitch = (ridge - eave) / (v1 + o)
  fillPolygon(
    bitmap,
    [P(u0 - o, v1 + o, eave), P(u1 + o, v1 + o, eave), P(u1 + o, 0, ridge), P(u0 - o, 0, ridge)],
    (x, y) => {
      const px = x + 0.5 - ax
      const py = y + 0.5 - ay
      const v = (py - px / 2 + ridge) / (2 * HALF_H + pitch)
      if (v < 0.045) return tones[4]
      if (v > 0.42) return tones[1]
      return v > 0.25 ? tones[3] : tones[2]
    },
  )

  // A low step on the front face upgrades the lodge and club without widening their lot.
  if (level >= 2 && (lodge || club)) {
    fillPolygon(
      bitmap,
      [P(-0.34, v1, 1), P(0.22, v1, 1), P(0.22, 0.61, 1), P(-0.34, 0.61, 1)],
      () => "#a9a48d",
    )
    if (lodge) {
      fillPolygon(
        bitmap,
        [P(-0.36, v1, 16), P(0.22, v1, 16), P(0.22, 0.62, 13), P(-0.36, 0.62, 13)],
        () => tones[3],
      )
    }
  }

  if (lodge && level === 3) {
    // The chimney stays readable as one shape even when its masonry does not.
    const left = 0.05
    const right = 0.29
    const front = 0.18
    const back = -0.04
    const top = ridge + 6
    fillPolygon(
      bitmap,
      [
        P(left, front, top - 12),
        P(right, front, top - 12),
        P(right, front, top),
        P(left, front, top),
      ],
      () => "#aa8a70",
    )
    fillPolygon(
      bitmap,
      [
        P(right, front, top - 12),
        P(right, back, top - 12),
        P(right, back, top),
        P(right, front, top),
      ],
      () => "#705844",
    )
    fillPolygon(
      bitmap,
      [P(left, front, top), P(right, front, top), P(right, back, top), P(left, back, top)],
      () => "#c9a082",
    )
  } else if (club && level === 3) {
    const [flagX, flagY] = P(-0.28, 0, ridge)
    fillPolygon(
      bitmap,
      [
        [flagX, flagY],
        [flagX + 2, flagY],
        [flagX + 2, flagY - 11],
        [flagX, flagY - 11],
      ],
      () => "#7e5638",
    )
    fillPolygon(
      bitmap,
      [
        [flagX + 1, flagY - 11],
        [flagX + 11, flagY - 8],
        [flagX + 1, flagY - 5],
      ],
      () => "#f1bc53",
    )
  } else if (!lodge && !club && level >= 2) {
    if (level === 3) {
      // A roof dormer reads above attendees, while the planter decorates the gable below.
      const [x, y] = P(-0.08, 0.24, ridge - pitch * 0.24)
      fillPolygon(
        bitmap,
        [
          [x - 4, y + 3],
          [x + 4, y + 7],
          [x + 4, y - 1],
          [x - 4, y - 5],
        ],
        () => wall.plaster,
      )
      fillPolygon(
        bitmap,
        [
          [x - 2, y + 2],
          [x + 2, y + 4],
          [x + 2, y],
          [x - 2, y - 2],
        ],
        () => pane,
      )
      fillPolygon(
        bitmap,
        [
          [x - 5, y - 4],
          [x + 5, y + 1],
          [x + 1, y - 8],
          [x - 2, y - 9],
        ],
        () => tones[0],
      )
    }
    const left = -0.38
    const right = 0.22
    const front = 0.66
    fillPolygon(
      bitmap,
      [P(left, v1, 1), P(right, v1, 1), P(right, front, 1), P(left, front, 1)],
      () => wall.base,
    )
    for (const post of [left + 0.05, right - 0.05]) {
      fillPolygon(
        bitmap,
        [
          P(post - 0.055, front, 1),
          P(post + 0.055, front, 1),
          P(post + 0.055, front, 11),
          P(post - 0.055, front, 11),
        ],
        () => wall.timber,
      )
    }
    fillPolygon(
      bitmap,
      [
        P(left, v1, 15.5),
        P(right, v1, 15.5),
        P(right, front + 0.025, 11),
        P(left, front + 0.025, 11),
      ],
      () => tones[3],
    )
    fillPolygon(
      bitmap,
      [
        P(left, front + 0.025, 11),
        P(right, front + 0.025, 11),
        P(right, front + 0.025, 9.5),
        P(left, front + 0.025, 9.5),
      ],
      () => tones[1],
    )
  }

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
export function rock(seed: number, detailed = false): Sprite {
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
      if (best >= 0) put(bitmap, x, y, detailed ? shorelineBoulderColor(x, y, best) : tones[best]!)
    }
  if (seed > 0.4) {
    put(bitmap, 5, 6, "#7fa65a")
    put(bitmap, 6, 6, "#7fa65a")
    put(bitmap, 6, 5, "#9ccb73")
  }
  outline(bitmap, detailed ? "#464739" : "#3b3f45")
  return { bitmap, anchorX: W / 2, anchorY: H - 2 }
}

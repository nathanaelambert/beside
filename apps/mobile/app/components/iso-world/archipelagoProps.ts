// Pixel art for the archipelago: the rowboat that carries you between islands, the jetty each
// island moors it at, and the wooden name sign floating over each island when zoomed out.
// Same rules as props.ts: procedural, top-left light, 1px dark outline, no anti-aliasing.

import { createBitmap, hash, isSet, outline, put, type Bitmap } from "./bitmap"
import { SLAB } from "./paint"
import { HALF_H, HALF_W } from "./projection"
import { fillPolygon, type Point, type Sprite } from "./props"

const wood = {
  dark: "#3a2820",
  shade: "#5b3e29",
  mid: "#7a5538",
  light: "#946a45",
  pale: "#ab8155",
  edge: "#c8a06c",
  wet: "#2c3f3f",
}
const foam = ["#9fd2df", "#d5ecf2"] as const
const OUTLINE = "#3b2a2e"

/** Draws into an oversized bitmap around (ax, ay), then crops to the opaque pixels. */
function sketch(width: number, height: number, ax: number, ay: number, draw: (b: Bitmap) => void) {
  const bitmap = createBitmap(width, height)
  draw(bitmap)
  return crop(bitmap, ax, ay)
}

function crop(bitmap: Bitmap, ax: number, ay: number): Sprite {
  let x0 = bitmap.width
  let y0 = bitmap.height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < bitmap.height; y++)
    for (let x = 0; x < bitmap.width; x++)
      if (isSet(bitmap, x, y)) {
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x)
        y1 = Math.max(y1, y)
      }
  if (x1 < 0) return { bitmap: createBitmap(1, 1), anchorX: 0, anchorY: 0 }
  const out = createBitmap(x1 - x0 + 1, y1 - y0 + 1)
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const from = (y * bitmap.width + x) * 4
      const to = ((y - y0) * out.width + (x - x0)) * 4
      out.rgba.set(bitmap.rgba.subarray(from, from + 4), to)
    }
  return { bitmap: out, anchorX: ax - x0, anchorY: ay - y0 }
}

function line(bitmap: Bitmap, [x0, y0]: Point, [x1, y1]: Point, color: string) {
  let x = Math.round(x0)
  let y = Math.round(y0)
  const tx = Math.round(x1)
  const ty = Math.round(y1)
  const dx = Math.abs(tx - x)
  const dy = -Math.abs(ty - y)
  const sx = x < tx ? 1 : -1
  const sy = y < ty ? 1 : -1
  let err = dx + dy
  for (;;) {
    put(bitmap, x, y, color)
    if (x === tx && y === ty) return
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
}

function mirror(sprite: Sprite): Sprite {
  const { bitmap } = sprite
  const out = createBitmap(bitmap.width, bitmap.height)
  for (let y = 0; y < bitmap.height; y++)
    for (let x = 0; x < bitmap.width; x++) {
      const from = (y * bitmap.width + x) * 4
      const to = (y * bitmap.width + (bitmap.width - 1 - x)) * 4
      out.rgba.set(bitmap.rgba.subarray(from, from + 4), to)
    }
  return { bitmap: out, anchorX: bitmap.width - 1 - sprite.anchorX, anchorY: sprite.anchorY }
}

// --- Rowboat ---------------------------------------------------------------------------------

/**
 * Which way the bow points on screen. The hull is modelled along u (bow down-right, "se");
 * "nw" turns it round, and "sw"/"ne" are mirror images.
 */
export type Heading = "se" | "sw" | "ne" | "nw"

export function headingFor(dx: number, dy: number): Heading {
  if (dy >= 0) return dx >= 0 ? "se" : "sw"
  return dx >= 0 ? "ne" : "nw"
}

const BOAT = { half: 0.7, beam: 0.26, rim: 6 }
const boatCache = new Map<string, Sprite>()

/** Half-width of the hull at `u`, pointed at the bow (+u) and blunt at the stern. */
function beamAt(u: number) {
  const t = u / BOAT.half
  if (Math.abs(t) >= 1) return 0
  return BOAT.beam * (t > 0 ? Math.sqrt(1 - t * t * t * t) * (1 - t * 0.35) : Math.sqrt(1 - t ** 6))
}

function hullRing(P: (u: number, v: number, h: number) => Point, h: number, scale: number) {
  const points: Point[] = []
  const steps = 14
  for (let i = 0; i <= steps; i++) {
    const u = -BOAT.half + (2 * BOAT.half * i) / steps
    points.push(P(u * scale, beamAt(u) * scale, h))
  }
  for (let i = steps; i >= 0; i--) {
    const u = -BOAT.half + (2 * BOAT.half * i) / steps
    points.push(P(u * scale, -beamAt(u) * scale, h))
  }
  return points
}

/** Fill a closed, possibly concave outline by splitting it into convex quads along u. */
function fillHull(bitmap: Bitmap, ring: Point[], color: (x: number, y: number) => string) {
  const n = ring.length / 2
  for (let i = 0; i < n - 1; i++) {
    const a = ring[i]!
    const b = ring[i + 1]!
    const c = ring[ring.length - 2 - i]!
    const d = ring[ring.length - 1 - i]!
    fillPolygon(bitmap, [a, b, c, d], color)
  }
}

function drawBoat(bitmap: Bitmap, ax: number, ay: number, frame: 0 | 1, stern: boolean) {
  // `stern` true = bow toward -u (the hull is drawn reversed).
  const s = stern ? -1 : 1
  const P = (u: number, v: number, h: number): Point => [
    ax + (s * u - v) * HALF_W,
    ay + (s * u + v) * HALF_H - h,
  ]
  const oarSweep = frame === 0 ? 0.22 : -0.16
  const oar = (side: 1 | -1, color: string) => {
    const lock = P(-0.04, side * 0.25, BOAT.rim + 1)
    const blade = P(-0.04 + oarSweep, side * 0.7, 0)
    line(bitmap, lock, blade, color)
    // Blade: a short wide stroke where it meets the water.
    line(bitmap, blade, [blade[0] + 2, blade[1]], wood.pale)
    if (frame === 0) put(bitmap, Math.round(blade[0]) - 1, Math.round(blade[1]) + 1, foam[1])
  }

  oar(-1, wood.shade) // far oar first; the hull hides most of it

  // Stacked hull slices from the waterline up, darker and narrower below.
  for (let h = 0; h < BOAT.rim; h++) {
    const scale = 0.84 + (0.16 * h) / (BOAT.rim - 1)
    const color =
      h === 0
        ? wood.wet
        : h === BOAT.rim - 2
          ? "#c8573a"
          : h === BOAT.rim - 3
            ? "#efe3c8"
            : wood.mid
    fillHull(bitmap, hullRing(P, h, scale), (x, y) =>
      color === wood.mid && hash(x, y, 71) > 0.86 ? wood.shade : color,
    )
  }
  // Rim, then the dark hold inside it, then the seat across the middle.
  fillHull(bitmap, hullRing(P, BOAT.rim, 1), () => wood.edge)
  fillHull(bitmap, hullRing(P, BOAT.rim - 1, 0.74), (x, y) =>
    (x + y) % 4 === 0 ? wood.dark : wood.shade,
  )
  fillPolygon(
    bitmap,
    [
      P(-0.22, -0.2, BOAT.rim),
      P(-0.1, -0.2, BOAT.rim),
      P(-0.1, 0.2, BOAT.rim),
      P(-0.22, 0.2, BOAT.rim),
    ],
    () => wood.pale,
  )

  // Bow wave and wake, alternating with the stroke.
  const bow = P(BOAT.half + 0.02, 0, 0)
  const wake = P(-BOAT.half - 0.08, 0, 0)
  const dir = s
  const frameFoam: [number, number, string][] =
    frame === 0
      ? [
          [1 * dir, 1, foam[1]],
          [2 * dir, 0, foam[0]],
          [-3 * dir, 2, foam[0]],
        ]
      : [
          [1 * dir, 0, foam[0]],
          [0, 2, foam[1]],
          [2 * dir, 2, foam[0]],
        ]
  for (const [dx, dy, c] of frameFoam)
    put(bitmap, Math.round(bow[0] + dx), Math.round(bow[1] + dy), c)
  for (let i = 0; i < 3; i++)
    put(
      bitmap,
      Math.round(wake[0] - dir * (i * 3 + frame * 2)),
      Math.round(wake[1] - (i * 3 + frame * 2) / 2 + 1),
      i === 0 ? foam[1] : foam[0],
    )
}

function makeBoat(frame: 0 | 1, heading: Heading, front: boolean): Sprite {
  const key = `${frame}-${heading}-${front}`
  const cached = boatCache.get(key)
  if (cached) return cached
  const W = 72
  const H = 44
  const ax = 36
  const ay = 26
  const stern = heading === "nw" || heading === "ne"
  let sprite = sketch(W, H, ax, ay, (bitmap) => {
    drawBoat(bitmap, ax, ay, frame, stern)
    if (front) {
      // Keep only what is nearer the viewer than the seat: the front gunwale and near oar.
      // Everything above the rim line through the seat is cleared.
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) if (y < ay - BOAT.rim + 2) put0(bitmap, x, y)
    }
    outline(bitmap, OUTLINE)
    // The near oar sits over the outline so it reads in front of the hull.
    const s = stern ? -1 : 1
    const P = (u: number, v: number, h: number): Point => [
      ax + (s * u - v) * HALF_W,
      ay + (s * u + v) * HALF_H - h,
    ]
    const sweep = frame === 0 ? 0.22 : -0.16
    line(bitmap, P(-0.04, 0.25, BOAT.rim + 1), P(-0.04 + sweep, 0.7, 0), wood.light)
    const blade = P(-0.04 + sweep, 0.7, 0)
    line(bitmap, blade, [blade[0] + 2, blade[1]], wood.edge)
  })
  if (heading === "sw" || heading === "ne") sprite = mirror(sprite)
  boatCache.set(key, sprite)
  return sprite
}

function put0(bitmap: Bitmap, x: number, y: number) {
  bitmap.rgba[(y * bitmap.width + x) * 4 + 3] = 0
}

/** The rowboat, resting on the water. Anchor = waterline centre. Frames alternate the stroke. */
export function rowboat(frame: 0 | 1, heading: Heading = "se"): Sprite {
  return makeBoat(frame, heading, false)
}

/**
 * Only the near gunwale and oar, to draw over the rower so they sit inside the boat:
 * boat, then avatar at BOAT_SEAT, then this.
 */
export function rowboatFront(frame: 0 | 1, heading: Heading = "se"): Sprite {
  return makeBoat(frame, heading, true)
}

/** The rower's feet, relative to the boat anchor, in art pixels (sunk below the rim). */
export const BOAT_SEAT = { x: -2, y: 3 }

// --- Jetty -----------------------------------------------------------------------------------

/** Island edge the jetty leaves from (right-hand cliff, u = 18), in island tile space. */
export const JETTY = { u: 18, v: 8.5 }
const JETTY_LENGTH = 2.1
/** Where the boat floats while moored, alongside the jetty's near side. */
export const MOORING = { u: JETTY.u + 1.5, v: JETTY.v + 0.82 }
/** The boat sits on the sea, which is SLAB pixels below the island's lawn. */
export const SEA_LIFT = -SLAB

let jettySprite: Sprite | undefined
/**
 * A plank jetty from the cliff edge out over the sea, on posts. Anchor = where the deck
 * meets the island edge (u = JETTY.u, v = JETTY.v, ground level).
 */
export function jetty(): Sprite {
  if (jettySprite) return jettySprite
  const W = 80
  const H = 64
  const ax = 14
  const ay = 22
  jettySprite = sketch(W, H, ax, ay, (bitmap) => {
    const P = (u: number, v: number, h: number): Point => [
      ax + (u - v) * HALF_W,
      ay + (u + v) * HALF_H - h,
    ]
    const half = 0.3
    const deck = 1
    const post = (u: number, v: number, top: number, near: boolean) => {
      const a = P(u, v, top)
      const b = P(u, v, -SLAB + 1)
      for (let y = Math.round(a[1]); y <= Math.round(b[1]); y++) {
        const wet = y > b[1] - 4
        put(bitmap, Math.round(a[0]), y, wet ? wood.wet : near ? wood.shade : wood.dark)
        put(bitmap, Math.round(a[0]) + 1, y, wet ? wood.wet : near ? wood.dark : wood.dark)
      }
      // A ring of foam where it meets the sea.
      put(bitmap, Math.round(b[0]) - 1, Math.round(b[1]) + 1, foam[0])
      put(bitmap, Math.round(b[0]) + 2, Math.round(b[1]) + 1, foam[1])
    }
    // Far posts, then the deck's near edge and top, then near posts.
    for (const u of [0.7, 1.4, JETTY_LENGTH - 0.12]) post(u, -half + 0.05, 0, false)
    fillPolygon(
      bitmap,
      [
        P(0, half, 0),
        P(JETTY_LENGTH, half, 0),
        P(JETTY_LENGTH, half, -deck - 1),
        P(0, half, -deck - 1),
      ],
      () => wood.dark,
    )
    fillPolygon(
      bitmap,
      [
        P(JETTY_LENGTH, -half, 0),
        P(JETTY_LENGTH, half, 0),
        P(JETTY_LENGTH, half, -deck - 1),
        P(JETTY_LENGTH, -half, -deck - 1),
      ],
      () => wood.shade,
    )
    fillPolygon(
      bitmap,
      [P(0, -half, 0), P(JETTY_LENGTH, -half, 0), P(JETTY_LENGTH, half, 0), P(0, half, 0)],
      (x, y) => {
        // Boards run across the jetty (along v): shade by board index along u.
        const py = y + 0.5 - ay
        const px = x + 0.5 - ax
        const u = (px / HALF_W + py / HALF_H) / 2
        const board = Math.floor(u * 7)
        const within = u * 7 - board
        if (within < 0.16) return wood.shade
        const tone = hash(board, 3, 81)
        return tone > 0.7 ? wood.edge : tone > 0.3 ? wood.pale : wood.light
      },
    )
    for (const u of [0.7, 1.4, JETTY_LENGTH - 0.12]) post(u, half - 0.05, 3, true)
    // Mooring bollard with a rope coil at the end.
    const b = P(JETTY_LENGTH - 0.2, half - 0.12, 0)
    for (let y = -5; y <= 0; y++) {
      put(bitmap, Math.round(b[0]), Math.round(b[1]) + y, y === -5 ? wood.edge : wood.mid)
      put(bitmap, Math.round(b[0]) + 1, Math.round(b[1]) + y, wood.shade)
    }
    put(bitmap, Math.round(b[0]) - 1, Math.round(b[1]) - 2, "#d9c9a8")
    put(bitmap, Math.round(b[0]) + 2, Math.round(b[1]) - 2, "#d9c9a8")
    put(bitmap, Math.round(b[0]) + 2, Math.round(b[1]) - 1, "#b99f78")
    // A lantern post near the island end, so the jetty reads from far away.
    const l = P(0.35, -half + 0.08, 0)
    for (let y = -14; y <= 0; y++) put(bitmap, Math.round(l[0]), Math.round(l[1]) + y, wood.dark)
    for (const [dx, dy, c] of [
      [-1, -17, "#3b2a2e"],
      [0, -17, "#3b2a2e"],
      [1, -17, "#3b2a2e"],
      [-1, -16, "#f2c96b"],
      [0, -16, "#fff4cf"],
      [1, -16, "#f2c96b"],
      [-1, -15, "#f2c96b"],
      [0, -15, "#f6d77a"],
      [1, -15, "#e0a84a"],
    ] as const)
      put(bitmap, Math.round(l[0]) + dx, Math.round(l[1]) + dy, c)
    outline(bitmap, OUTLINE)
  })
  return jettySprite
}

// --- Open water ------------------------------------------------------------------------------

/** A channel buoy, bobbing between two frames. Anchor = waterline centre. */
export function buoy(frame: 0 | 1): Sprite {
  const key = `buoy-${frame}`
  const cached = boatCache.get(key)
  if (cached) return cached
  const bitmap = createBitmap(11, 15)
  const lift = frame
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 5; x++) {
      const band = Math.floor(y / 3) % 2 === 0
      put(
        bitmap,
        3 + x,
        3 + y - lift,
        x === 0 ? (band ? "#a8432a" : "#d9c9a8") : band ? "#c8573a" : "#efe3c8",
      )
    }
  put(bitmap, 5, 2 - lift, "#3a2820")
  put(bitmap, 5, 1 - lift, frame ? "#f6d77a" : "#fff4cf")
  for (let x = 1; x < 10; x++) put(bitmap, x, 12, x % 3 === 0 ? foam[1] : foam[0])
  outline(bitmap, OUTLINE)
  const sprite = { bitmap, anchorX: 5, anchorY: 12 }
  boatCache.set(key, sprite)
  return sprite
}

/** A low rock in the sea, sometimes with a resting gull. Anchor = waterline centre. */
export function seaRock(seed: number): Sprite {
  const key = `rock-${seed.toFixed(3)}`
  const cached = boatCache.get(key)
  if (cached) return cached
  const W = 26
  const H = 18
  const bitmap = createBitmap(W, H)
  const tones = ["#4f595f", "#6c787d", "#8f9b9f", "#b7c2c1"]
  const blobs = [
    [10, 12, 6.5],
    [16, 12.5, 4.5 + seed * 2],
  ]
  for (let y = 0; y < H - 3; y++)
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
      if (best >= 0) put(bitmap, x, y, y >= H - 4 ? "#3f4a4f" : tones[best]!)
    }
  if (seed > 0.45) {
    // A gull: white body, grey wing, yellow beak.
    for (const [x, y, c] of [
      [9, 5, "#f6f1e1"],
      [10, 5, "#f6f1e1"],
      [11, 5, "#b7c2c1"],
      [12, 5, "#8f9b9f"],
      [9, 4, "#f6f1e1"],
      [8, 4, "#f2c96b"],
      [10, 6, "#f2c96b"],
    ] as const)
      put(bitmap, x, y, c)
  }
  outline(bitmap, OUTLINE)
  // Foam where the rock meets the sea, left unoutlined so it reads as water.
  for (let x = 3; x < W - 3; x++)
    if (hash(x, 1, 97) > 0.35) put(bitmap, x, H - 3, x % 3 === 0 ? foam[1] : foam[0])
  const sprite = { bitmap, anchorX: W / 2, anchorY: H - 3 }
  boatCache.set(key, sprite)
  return sprite
}

// --- Island name sign ------------------------------------------------------------------------

// A 5 × 7 pixel font, uppercase only (names are shown in caps on the signs).
const GLYPHS: Record<string, string[]> = {
  "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  "C": [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  "G": [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  "I": ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
  "J": ["..###", "...#.", "...#.", "...#.", "#..#.", "#..#.", ".##.."],
  "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  "N": ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  "Q": [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "V": ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  "W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  "X": ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  "Z": ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": [".#.", "##.", ".#.", ".#.", ".#.", ".#.", "###"],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": ["..", "..", "..", "..", "..", "..", ".."],
  "-": ["....", "....", "....", "####", "....", "....", "...."],
  ".": [".", ".", ".", ".", ".", ".", "#"],
  "'": ["#", "#", ".", ".", ".", ".", "."],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
}

function glyphFor(char: string) {
  const plain = char.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
  if (plain === "’" || plain === "‘") return GLYPHS["'"]!
  return GLYPHS[plain] ?? GLYPHS["?"]!
}

/** Width in pixels of `text` in the sign font (1px between letters). */
export function signTextWidth(text: string) {
  return [...text].reduce((sum, char, i) => sum + glyphFor(char)[0]!.length + (i ? 1 : 0), 0)
}

/** Longest name before the sign truncates with a trailing "..". */
const SIGN_MAX_TEXT = 92

function fitName(name: string) {
  let text = name.trim()
  if (signTextWidth(text) <= SIGN_MAX_TEXT) return text
  while (text.length > 1 && signTextWidth(`${text}..`) > SIGN_MAX_TEXT) text = text.slice(0, -1)
  return `${text.trimEnd()}..`
}

const signCache = new Map<string, Sprite>()
/**
 * A hanging plank sign with the island's name burnt into it. Drawn at its own fixed screen
 * scale (not the world zoom) so it stays readable when the archipelago is zoomed out.
 * `here` adds a small pennant marking the island you're on. Anchor = bottom of the post.
 */
export function islandSign(name: string, here = false): Sprite {
  const key = `${here}-${name}`
  const cached = signCache.get(key)
  if (cached) return cached
  const text = fitName(name)
  const textW = signTextWidth(text)
  const boardW = textW + 10
  const boardH = 13
  const postH = 6
  const W = boardW + 4
  const H = boardH + postH + (here ? 9 : 2)
  const bitmap = createBitmap(W, H)
  const top = here ? 8 : 1
  const left = 2
  // Board with a lighter top edge, plank seam and worn corners.
  for (let y = 0; y < boardH; y++)
    for (let x = 0; x < boardW; x++) {
      const corner = (x === 0 || x === boardW - 1) && (y === 0 || y === boardH - 1)
      if (corner) continue
      const color =
        y === 0
          ? wood.edge
          : y === boardH - 1
            ? wood.shade
            : y === 6 && hash(x >> 2, 0, 91) > 0.5
              ? wood.light
              : hash(x, y, 93) > 0.93
                ? wood.light
                : wood.pale
      put(bitmap, left + x, top + y, color)
    }
  // Nails.
  put(bitmap, left + 2, top + 2, wood.dark)
  put(bitmap, left + boardW - 3, top + 2, wood.dark)
  // Letters, burnt dark with a pale highlight under each stroke.
  let cursor = left + 5
  for (const char of text) {
    const glyph = glyphFor(char)
    glyph.forEach((row, gy) =>
      [...row].forEach((cell, gx) => {
        if (cell !== "#") return
        put(bitmap, cursor + gx, top + 3 + gy + 1, wood.edge)
      }),
    )
    glyph.forEach((row, gy) =>
      [...row].forEach((cell, gx) => {
        if (cell === "#") put(bitmap, cursor + gx, top + 3 + gy, "#3a2820")
      }),
    )
    cursor += glyph[0]!.length + 1
  }
  // Post under the middle.
  const postX = left + Math.floor(boardW / 2) - 1
  for (let y = top + boardH; y < top + boardH + postH; y++) {
    put(bitmap, postX, y, wood.mid)
    put(bitmap, postX + 1, y, wood.shade)
  }
  if (here) {
    // A little pennant on a pin above the board: "you are here".
    const px = left + boardW - 6
    for (let y = 0; y < top; y++) put(bitmap, px, y, wood.dark)
    for (const [dx, dy] of [
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
      [2, 2],
      [1, 3],
    ] as const)
      put(bitmap, px + dx, dy, dx + dy < 3 ? "#ec9aa6" : "#c4677b")
  }
  outline(bitmap, OUTLINE)
  const sprite = { bitmap, anchorX: postX + 1, anchorY: H - 1 }
  signCache.set(key, sprite)
  return sprite
}

// --- Per-island variety ----------------------------------------------------------------------

/** A stable number in [0, 1) for each home base, used to vary trees, bushes and rocks. */
export function islandVariantSeed(homebaseId: string): number {
  let h = 2166136261
  for (let i = 0; i < homebaseId.length; i++) {
    h ^= homebaseId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

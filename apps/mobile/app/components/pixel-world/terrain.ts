// The meadow is painted once into an RGBA buffer at one byte per world pixel channel, then
// drawn as a single nearest-neighbour image. `ground` records what each pixel is, so
// placement rules follow the art instead of hand-tuned rectangles.

export const WORLD_WIDTH = 288
export const WORLD_HEIGHT = 240

export const Ground = {
  Lawn: 0,
  Woods: 1,
  Path: 2,
  Water: 3,
  Shore: 4,
  Dock: 5,
  Blanket: 6,
} as const
export type GroundKind = (typeof Ground)[keyof typeof Ground]

export const POND = { x: 220, y: 146, rx: 36, ry: 27 }
export const DOCK = { x0: 180, x1: 205, y0: 141, y1: 149 }
export const BLANKET = { x0: 135, x1: 177, y0: 133, y1: 150 }

// Path centre line: from the south edge to the blanket, with a branch to the dock.
const PATH_SEGMENTS: [number, number][][] = [
  [
    [134, 244],
    [130, 226],
    [137, 208],
    [148, 190],
    [151, 172],
    [150, 152],
  ],
  [
    [160, 156],
    [170, 151],
    [182, 146],
  ],
]

const C = {
  grass: ["#7e9d5a", "#8aa963", "#95b46b", "#a3c177", "#b4ce88"],
  tuftDark: "#6c8c4e",
  tuftLight: "#c2d896",
  woods: ["#1f3427", "#2b4632", "#375a3b", "#476f45", "#5b8550", "#7aa25f"],
  woodsShadow: "#6a8a50",
  dirt: ["#9f7f55", "#b8966a", "#cdae7f", "#dcc193", "#eadab0"],
  shore: ["#8a7a56", "#b4a272", "#d0bf8f", "#e2d4a6"],
  water: ["#3f727c", "#4e8890", "#5e9c9f", "#73b0ad", "#8fc4bb", "#c4e3d6"],
  lily: ["#3f6e41", "#5c9150", "#7fb262"],
  reed: ["#4c6b3c", "#6b8d4b", "#7a5838", "#9a7046"],
  plank: ["#3a2820", "#5a3d2c", "#7c573a", "#a27a4e", "#c8a06c", "#dbb985"],
  blanket: ["#8c4256", "#c4677b", "#ec9aa6", "#f5e6cf", "#e2cdb0", "#b98f86"],
  petals: ["#f6f1e1", "#f2c96b", "#ec9aa6", "#b7c6e8"],
  stone: ["#6c8086", "#93a6a5", "#bfcdc6"],
}

function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 982451653)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function noise(x: number, y: number, cell: number, seed: number) {
  const gx = x / cell
  const gy = y / cell
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const tx = gx - x0
  const ty = gy - y0
  const sx = tx * tx * (3 - 2 * tx)
  const sy = ty * ty * (3 - 2 * ty)
  const a = hash(x0, y0, seed)
  const b = hash(x0 + 1, y0, seed)
  const c = hash(x0, y0 + 1, seed)
  const d = hash(x0 + 1, y0 + 1, seed)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

function distanceToSegment(px: number, py: number, [ax, ay]: number[], [bx, by]: number[]) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

function pathDistance(x: number, y: number) {
  let best = Infinity
  for (const line of PATH_SEGMENTS)
    for (let i = 1; i < line.length; i++)
      best = Math.min(best, distanceToSegment(x, y, line[i - 1], line[i]))
  return best
}

// Normalised pond distance: < 1 inside, with a wobbly natural edge.
function pondDistance(x: number, y: number) {
  const dx = (x - POND.x) / POND.rx
  const dy = (y - POND.y) / POND.ry
  const angle = Math.atan2(dy, dx)
  const wobble = 1 + 0.07 * Math.sin(angle * 3 + 0.6) + 0.04 * Math.sin(angle * 5 + 2.1)
  return Math.hypot(dx, dy) / wobble
}

// How deep into the woodland border a point is; > 0 means woods. The north edge is deeper,
// like a treeline seen from the meadow.
function woodsDepth(x: number, y: number) {
  const edge = Math.min(x + 2, WORLD_WIDTH - x, y - 6, WORLD_HEIGHT - y + 4)
  return 12 + noise(x, y, 18, 3) * 12 - edge
}

const BUSH_CELL = 9
const BUSH_PERIOD = 8
// The canopy pattern repeats every 72 px, so a tile of it can surround the world seamlessly.
export const WOODS_TILE = BUSH_CELL * BUSH_PERIOD
const wrap = (n: number) => ((n % BUSH_PERIOD) + BUSH_PERIOD) % BUSH_PERIOD

// Woodland canopy as overlapping, dome-lit bushes on a jittered grid. Only bushes rooted in
// the border count, so the forest edge is scalloped by whole bushes instead of noise.
// Returns -1 for open lawn, 0 for a bush rim, and 1-4 for lit canopy tones.
function bushTone(
  x: number,
  y: number,
  rooted = (cx: number, cy: number) => woodsDepth(cx, cy) > 0,
) {
  let best = Infinity
  let tone = -1
  const cell = BUSH_CELL
  const gx = Math.floor(x / cell)
  const gy = Math.floor(y / cell)
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const hx = wrap(gx + i)
      const hy = wrap(gy + j)
      const cx = (gx + i) * cell + hash(hx, hy, 11) * cell
      const cy = (gy + j) * cell + hash(hx, hy, 12) * cell
      if (!rooted(cx, cy)) continue
      const r = 6.5 + hash(hx, hy, 13) * 3
      const nx = (x + 0.5 - cx) / r
      const ny = (y + 0.5 - cy) / r
      const d = Math.hypot(nx, ny)
      // Lower bushes overlap higher ones, as seen from slightly above.
      const score = d * 0.6 - cy * 0.02
      if (d >= 1 || score >= best) continue
      best = score
      const lit = -nx * 0.55 - ny * 0.75 + Math.sqrt(Math.max(0, 1 - d * d)) * 0.5
      tone = d > 0.86 && ny > -0.2 ? 0 : lit > 0.75 ? 4 : lit > 0.4 ? 3 : lit > 0.05 ? 2 : 1
    }
  return tone
}

let woodsTile: Uint8Array | undefined

// Endless forest for whatever lies beyond the world's edges.
export function getWoodsTile() {
  if (!woodsTile) {
    woodsTile = new Uint8Array(WOODS_TILE * WOODS_TILE * 4)
    for (let y = 0; y < WOODS_TILE; y++)
      for (let x = 0; x < WOODS_TILE; x++) {
        const color = C.woods[bushTone(x, y, () => true) + 1]
        const i = (y * WOODS_TILE + x) * 4
        woodsTile[i] = parseInt(color.slice(1, 3), 16)
        woodsTile[i + 1] = parseInt(color.slice(3, 5), 16)
        woodsTile[i + 2] = parseInt(color.slice(5, 7), 16)
        woodsTile[i + 3] = 255
      }
  }
  return woodsTile
}

export interface Terrain {
  rgba: Uint8Array
  ground: Uint8Array
}

let cached: Terrain | undefined

export function getTerrain(): Terrain {
  if (!cached) cached = paintTerrain()
  return cached
}

export function groundAt(x: number, y: number): GroundKind {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  if (ix < 0 || iy < 0 || ix >= WORLD_WIDTH || iy >= WORLD_HEIGHT) return Ground.Woods
  return getTerrain().ground[iy * WORLD_WIDTH + ix] as GroundKind
}

function paintTerrain(): Terrain {
  const rgba = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT * 4)
  const ground = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT)
  const put = (x: number, y: number, color: string, kind?: GroundKind) => {
    if (x < 0 || y < 0 || x >= WORLD_WIDTH || y >= WORLD_HEIGHT) return
    const i = (y * WORLD_WIDTH + x) * 4
    rgba[i] = parseInt(color.slice(1, 3), 16)
    rgba[i + 1] = parseInt(color.slice(3, 5), 16)
    rgba[i + 2] = parseInt(color.slice(5, 7), 16)
    rgba[i + 3] = 255
    if (kind !== undefined) ground[y * WORLD_WIDTH + x] = kind
  }
  const kindAt = (x: number, y: number) => ground[y * WORLD_WIDTH + x]

  // 1. Lawn: soft patches of tone, a sunlit centre, dithered where tones meet.
  for (let y = 0; y < WORLD_HEIGHT; y++)
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const sun = 1 - Math.hypot((x - 146) / 150, (y - 140) / 120)
      const t =
        noise(x, y, 26, 1) * 0.55 +
        noise(x, y, 9, 2) * 0.25 +
        sun * 0.75 +
        (hash(x, y, 5) - 0.5) * 0.12
      const tone = Math.max(0, Math.min(4, Math.floor(t * 3.2)))
      put(x, y, C.grass[tone], Ground.Lawn)
    }

  // 2. Path, with darker rims, a worn lighter centre, and pebbles.
  for (let y = 0; y < WORLD_HEIGHT; y++)
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const d = pathDistance(x + 0.5, y + 0.5)
      const half = 4.6 + noise(x, y, 7, 6) * 2
      if (d > half + 1.2) continue
      if (d > half) {
        put(x, y, C.grass[0])
        continue
      }
      const lit = d < half * 0.35 ? 3 : d > half - 1 ? 1 : 2
      put(x, y, hash(x, y, 7) > 0.985 ? C.dirt[0] : C.dirt[lit], Ground.Path)
      if (hash(x, y, 8) > 0.988 && d < half - 1.5) {
        put(x, y, C.dirt[4])
        put(x, y + 1, C.dirt[0])
      }
    }

  // 3. Pond: grassy bank shadow, sandy shore, then shallow-to-deep water.
  for (let y = 100; y < 190; y++)
    for (let x = 170; x < WORLD_WIDTH; x++) {
      const q = pondDistance(x + 0.5, y + 0.5)
      if (q > 1.09) continue
      if (q > 1) {
        if (kindAt(x, y) === Ground.Lawn) put(x, y, C.grass[0])
        continue
      }
      if (q > 0.9) {
        const tone = y < POND.y ? 2 : 1
        put(x, y, hash(x, y, 9) > 0.8 ? C.shore[tone + 1] : C.shore[tone], Ground.Shore)
        continue
      }
      // Seen from above and south, the north bank shades the water just below it.
      const north = pondDistance(x + 0.5, y - 3.5) > 0.9
      const level = north ? 0 : q > 0.78 ? 4 : q > 0.6 ? 3 : q > 0.38 ? 2 : 1
      put(x, y, C.water[level], Ground.Water)
    }
  // Shore lip: one darker pixel where sand meets water on the south side.
  for (let y = POND.y; y < 190; y++)
    for (let x = 170; x < WORLD_WIDTH; x++)
      if (kindAt(x, y) === Ground.Water && kindAt(x, y + 1) === Ground.Shore)
        put(x, y + 1, C.shore[0])
  // Ripples and glints.
  const glints = [
    [228, 131, 5],
    [212, 139, 3],
    [238, 150, 4],
    [222, 160, 6],
    [244, 139, 2],
    [206, 155, 3],
  ]
  for (const [gx, gy, w] of glints) {
    for (let i = 0; i < w; i++) put(gx + i, gy, C.water[5])
    put(gx - 1, gy + 1, C.water[3])
    put(gx + w, gy + 1, C.water[3])
  }
  // Lily pads with one blossom.
  const pads: [number, number, boolean][] = [
    [236, 162, true],
    [246, 151, false],
    [207, 129, false],
    [227, 168, false],
  ]
  for (const [px, py, bloom] of pads) {
    for (let y = -2; y <= 2; y++)
      for (let x = -3; x <= 3; x++) {
        if ((x / 3.4) ** 2 + (y / 2.2) ** 2 > 1) continue
        if (x >= 1 && y === 0) continue // the notch
        put(px + x, py + y, y === 2 || x === 3 ? C.lily[0] : x + y < -1 ? C.lily[2] : C.lily[1])
      }
    if (bloom) {
      put(px - 1, py - 2, C.petals[2])
      put(px, py - 3, C.petals[2])
      put(px + 1, py - 2, C.petals[2])
      put(px, py - 2, C.petals[0])
    }
  }
  // Reeds and cattails on the far banks.
  const reeds = [
    [250, 124],
    [253, 126],
    [256, 129],
    [247, 123],
    [196, 165],
    [199, 168],
    [193, 162],
  ]
  for (const [rx, ry] of reeds) {
    const h = 5 + Math.floor(hash(rx, ry, 10) * 4)
    for (let i = 0; i < h; i++) put(rx, ry - i, i < 2 ? C.reed[0] : C.reed[1], Ground.Shore)
    if (hash(rx, ry, 14) > 0.4) {
      put(rx, ry - h, C.reed[3])
      put(rx, ry - h - 1, C.reed[2])
      put(rx, ry - h + 1, C.reed[2])
    }
  }

  // 4. Dock: boards run across the pier, with a shaded front face and posts.
  for (let y = DOCK.y0; y <= DOCK.y1 + 3; y++)
    for (let x = DOCK.x0; x <= DOCK.x1; x++) {
      if (y > DOCK.y1) {
        // Front face, then posts dipping into the water.
        const post = x === DOCK.x0 + 6 || x === DOCK.x0 + 7 || x === DOCK.x1 - 1 || x === DOCK.x1
        if (y === DOCK.y1 + 1) put(x, y, C.plank[1], Ground.Dock)
        else if (post) put(x, y, y === DOCK.y1 + 2 ? C.plank[1] : C.plank[0], Ground.Dock)
        continue
      }
      const board = Math.floor((x - DOCK.x0) / 3)
      const seam = (x - DOCK.x0) % 3 === 2
      const tone = seam ? 2 : y === DOCK.y0 ? 5 : board % 2 ? 3 : 4
      put(x, y, C.plank[tone], Ground.Dock)
      if (!seam && hash(board, y, 15) > 0.9) put(x, y, C.plank[3])
    }
  for (let x = DOCK.x0; x <= DOCK.x1; x++) put(x, DOCK.y0 - 1, C.plank[0])
  for (let y = DOCK.y0 - 1; y <= DOCK.y1 + 1; y++) put(DOCK.x1 + 1, y, C.plank[0])

  // 5. Picnic blanket: gingham with a stitched rim and a small cast shadow.
  for (let y = BLANKET.y0; y <= BLANKET.y1 + 1; y++)
    for (let x = BLANKET.x0; x <= BLANKET.x1 + 1; x++) {
      if (y > BLANKET.y1 || x > BLANKET.x1) {
        if (y > BLANKET.y0 && x > BLANKET.x0) put(x, y, C.grass[0])
        continue
      }
      const rim = x === BLANKET.x0 || x === BLANKET.x1 || y === BLANKET.y0 || y === BLANKET.y1
      const bx = Math.floor((x - BLANKET.x0) / 3) % 2
      const by = Math.floor((y - BLANKET.y0) / 3) % 2
      const tone = rim ? 0 : bx && by ? 1 : bx || by ? 2 : 3
      put(x, y, C.blanket[tone], Ground.Blanket)
    }
  // Basket in the corner of the blanket.
  const basket = ["..aaaa..", ".a....a.", "abbbbbba", "acdcdcda", "adcdcdca", ".aaaaaa."]
  const basketPal: Record<string, string> = {
    a: C.plank[0],
    b: C.plank[5],
    c: C.plank[4],
    d: C.plank[3],
  }
  basket.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch !== ".") put(BLANKET.x1 - 10 + i, BLANKET.y0 + 4 + j, basketPal[ch])
    }),
  )
  // A napkin peeking out of the basket.
  put(BLANKET.x1 - 7, BLANKET.y0 + 5, C.blanket[2])
  put(BLANKET.x1 - 6, BLANKET.y0 + 5, C.blanket[1])

  // 6. Woodland border with a soft shadow on the lawn beneath it.
  const woods = new Int8Array(WORLD_WIDTH * WORLD_HEIGHT)
  for (let y = 0; y < WORLD_HEIGHT; y++)
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const tone = bushTone(x, y)
      // Deep inside the border, a gap between bushes is just deep shade.
      woods[y * WORLD_WIDTH + x] = tone < 0 && woodsDepth(x, y) > 6 ? 0 : tone
    }
  const isWoods = (x: number, y: number) =>
    x < 0 || y < 0 || x >= WORLD_WIDTH || y >= WORLD_HEIGHT || woods[y * WORLD_WIDTH + x] >= 0
  for (let y = 0; y < WORLD_HEIGHT; y++)
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const tone = woods[y * WORLD_WIDTH + x]
      if (tone < 0) {
        if (
          (isWoods(x, y - 1) || isWoods(x, y - 2) || isWoods(x - 1, y - 2)) &&
          kindAt(x, y) !== Ground.Water
        )
          put(x, y, C.woodsShadow)
        continue
      }
      const edge =
        !isWoods(x + 1, y) || !isWoods(x - 1, y) || !isWoods(x, y + 1) || !isWoods(x, y - 1)
      put(x, y, C.woods[edge ? 0 : tone + 1], Ground.Woods)
    }

  // 7. Lawn details: tufts and wildflower clusters, only on open lawn.
  for (let i = 0; i < 420; i++) {
    const x = Math.floor(hash(i, 0, 20) * WORLD_WIDTH)
    const y = Math.floor(hash(i, 1, 20) * WORLD_HEIGHT)
    if (kindAt(x, y) !== Ground.Lawn || kindAt(x + 2, y) !== Ground.Lawn) continue
    put(x, y, C.tuftDark)
    put(x + 2, y, C.tuftDark)
    put(x + 1, y + 1, C.tuftDark)
    if (i % 3 === 0) put(x + 1, y, C.tuftLight)
  }
  for (let i = 0; i < 34; i++) {
    const cx = Math.floor(hash(i, 2, 21) * WORLD_WIDTH)
    const cy = Math.floor(hash(i, 3, 21) * WORLD_HEIGHT)
    const color = C.petals[i % 4]
    for (let k = 0; k < 3 + (i % 3); k++) {
      const x = cx + Math.floor((hash(i, k, 22) - 0.5) * 9)
      const y = cy + Math.floor((hash(i, k, 23) - 0.5) * 6)
      if (kindAt(x, y) !== Ground.Lawn || kindAt(x, y + 1) !== Ground.Lawn) continue
      put(x, y, color)
      put(x, y + 1, C.tuftDark)
    }
  }
  // A few mossy stones along the path.
  for (const [sx, sy] of [
    [124, 214],
    [158, 182],
    [143, 198],
    [176, 158],
  ]) {
    put(sx, sy, C.stone[2])
    put(sx + 1, sy, C.stone[1])
    put(sx, sy + 1, C.stone[1])
    put(sx + 1, sy + 1, C.stone[0])
    put(sx - 1, sy + 1, C.tuftDark)
  }

  return { rgba, ground }
}

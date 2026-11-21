import { hash, noise, put, rgb, type Bitmap } from "./bitmap"
import { HALF_W, isoToScreen, type MapFrame } from "./projection"
import { tileAt, type CoastMaterial, type Tile, type TileMap } from "./tilemap"
import { shoreFoamColor } from "./waterArt"

const stones = {
  sandstone: ["#73583f", "#8f7354", "#ab906d", "#c2a37a"],
  granite: ["#414e48", "#576453", "#73806a", "#92947b"],
  slate: ["#47565e", "#536b73", "#70848d", "#91a2a7"],
} as const
const sunlitStone = {
  sandstone: ["#645443", "#857153", "#a08a65", "#bca47b", "#d3bd93"],
  granite: ["#46534a", "#5d6c5a", "#7c896f", "#9caa8a", "#bcc6a7"],
  slate: ["#40555b", "#546c70", "#71868a", "#91a5a3", "#b3bfb6"],
} as const
const wetStone = {
  sandstone: ["#626f59", "#7a8266"],
  granite: ["#425e55", "#5d776a"],
  slate: ["#3e6166", "#58767a"],
} as const

/** Chunky facets and damp feet for boulders, kept within their existing pixels. */
export function shorelineBoulderColor(x: number, y: number, level: number, wet = false) {
  if (wet) return wetStone.granite[level > 1 ? 1 : 0]
  const chip = noise(x + y * 0.42, y, 4, 124)
  const seam = (x + Math.floor(y * 0.75)) % 9 === 0 && chip > 0.48
  const face = seam ? Math.max(0, level - 1) : level + (chip > 0.66 ? 1 : 0)
  return sunlitStone.sandstone[face]!
}

/** Warm, irregular rock clusters rather than straight bands at the open coast. */
export function coastRock(
  material: CoastMaterial,
  face: "left" | "right",
  depth: number,
  x: number,
  y: number,
  detailed: boolean,
  height: number,
) {
  const n = noise(x + 0.32 * y, y, 5, 27) * 0.65 + noise(x, y, 11, 4) * 0.35
  if (detailed) {
    // Moss hugs the lawn and drapes over a few exposed corners.
    const lip = 1.2 + noise(x, y, 9, 32) * 3.8
    if (depth < lip) {
      if (depth >= lip - 1.1) return n > 0.52 ? "#42563a" : "#566744"
      return n > 0.56 ? "#879554" : n > 0.4 ? "#70854d" : "#506743"
    }
    if (height - depth < 2.15 + n * 1.65) return wetStone[material][n > 0.45 ? 1 : 0]
    // Offset the ledges along the face, with muted fissures and a light-catching cap.
    const terrace = depth + (noise(x, y, 13, 81) - 0.5) * 3.5
    const row = Math.floor(terrace / 5.2)
    const across = x + row * 6 + (noise(x, y, 8, 82) - 0.5) * 5
    const block = Math.floor(across / 11)
    const joint = across - block * 11
    const shade = hash(block, row, 17)
    const ledge = terrace - row * 5.2
    const light = face === "left" ? 1 : 0
    const chip = joint < 0.8 && ledge > 1.3 && shade > 0.26
    const cap = ledge < 1.15 && joint > 1.25
    const facet = chip ? light : 1 + light + (shade > 0.62 ? 1 : 0) + (cap ? 1 : 0)
    return sunlitStone[material][Math.min(facet, 4)]!
  }
  if (depth < 2 + Math.floor(4 * n)) return n > 0.52 ? "#789653" : "#4b713e"
  const grain = (hash(x, y, 23) - 0.5) * 0.2
  const index = Math.max(0, Math.min(3, Math.floor((n + grain) * 5) - (face === "right" ? 1 : 0)))
  return stones[material][index]!
}

const picnicShoreStart = 7
const picnicShoreEnd = 15

/** Distance along the left face of the pilot shore, in logical art pixels. */
export const picnicShoreDistance = (tile: Tile, along: number) =>
  (tile.col + along - picnicShoreStart) * HALF_W

/** One exposed run below the main meadow. Fade only RGB at its two joins. */
export function picnicShoreInfluence(
  map: TileMap,
  tile: Tile,
  dc: number,
  dr: number,
  along: number,
) {
  if (
    map.coastFinish !== "picnic-headland" ||
    map.art !== "detailed" ||
    tile.row !== map.rows - 1 ||
    dc !== 0 ||
    dr !== 1
  )
    return 0
  const position = tile.col + along
  return Math.max(
    0,
    Math.min(1, (position - picnicShoreStart) / 0.92, (picnicShoreEnd - position) / 0.92),
  )
}

function shoreBlend(before: string, after: string, weight: number) {
  if (weight >= 1) return after
  const a = rgb(before)
  const b = rgb(after)
  return (
    "#" +
    a
      .map((n, i) =>
        Math.round(n + (b[i]! - n) * weight)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  )
}

const limestoneFace = {
  cap: "#c6b493",
  sun: "#b7a37f",
  mid: "#a18f72",
  turn: "#8e8066",
  joint: "#7e735d",
  damp: "#747961",
  wet: "#586e5e",
  olive: "#7e884d",
  moss: "#69794b",
  mossShadow: "#4d6444",
}

type Ledge = {
  /** Extent of a projecting face in the same logical pixels as the spray. */
  from: number
  to: number
  neck: number
  foot: number
  shelf: number
  cap: number
}

// Broad limestone lenses interrupted by recessed marl, not a regular masonry wall.
// The contours are painted inside the slab's original coverage.
const ledges: readonly Ledge[] = [
  { from: 3, to: 44, neck: 39, foot: 31, shelf: 0.31, cap: 0.105 },
  { from: 44, to: 57, neck: 53, foot: 47, shelf: 0.55, cap: 0.065 },
  { from: 65, to: 103, neck: 94, foot: 100, shelf: 0.37, cap: 0.135 },
  { from: 101, to: 113, neck: 111, foot: 107, shelf: 0.49, cap: 0.065 },
  { from: 113, to: 129, neck: 123, foot: 127, shelf: 0.42, cap: 0.105 },
]

// The two salients have a short, tapered line of light in the nearest spray pixels.
// Their wash also tints the edge of the dry rock, behind the same pool.
const salientWash = [
  { from: 40, to: 47, crestFrom: 42, crestTo: 45 },
  { from: 84, to: 90, crestFrom: 85, crestTo: 88 },
] as const

function shoreWash(along: number) {
  return salientWash.find(({ from, to }) => along >= from - 2 && along <= to + 1)
}

/** A damp edge stays in the existing silhouette and tapers into exposed dry ledges. */
export function picnicShoreContact(along: number, weight: number, outline: string) {
  const wash = shoreWash(along)
  const contact = wash && along >= wash.from && along <= wash.to
  return shoreBlend(outline, contact ? "#536c5f" : "#465346", weight * (contact ? 0.94 : 0.73))
}

/** Fine gray-olive fissures terminate in the stone rather than covering a whole column. */
function shoreCleavage(along: number, strata: number) {
  if (strata > 0.26 && strata < 0.61 && Math.abs(along - (27 - 6 * strata)) < 1.25) return true
  if (strata > 0.41 && strata < 0.76 && Math.abs(along - (59 + 6 * strata)) < 1.2) return true
  return strata > 0.27 && strata < 0.63 && Math.abs(along - (103 - 6 * strata)) < 1.34
}

/** Two wide dry shelves, a cool recess and short returns eroded into the same slab. */
export function picnicShoreFinish(
  x: number,
  y: number,
  depth: number,
  height: number,
  weight: number,
  along: number,
) {
  const rock = limestoneFace
  const strata = depth / height
  const shelf = ledges.find(({ from, to }) => along >= from && along < to)
  const spacing = shelf ? along - shelf.from : 0
  const entrance = shelf ? Math.min(1, Math.max(0, (7 - spacing) / 7)) : 1
  const shaded = !shelf || (spacing < 4 && shelf.to - shelf.from < 20)
  const moss = 1.2 + entrance * 1.4 + (along > 53 && along < 67 ? 0.63 : 0)
  let color: string
  if (depth < moss) {
    color =
      depth > moss - 0.78 ? rock.mossShadow : along > 53 && along < 67 ? rock.moss : rock.olive
  } else if (shoreCleavage(along, strata)) {
    color = strata < 0.47 ? "#897f64" : "#7d7d63"
  } else if (!shelf || shaded) {
    // The gray fold still has a dry flange and damp lower plane; it is solid rock.
    color = strata < 0.47 ? rock.mid : strata < 0.68 ? rock.turn : rock.damp
    if (strata > 0.85) color = rock.wet
  } else {
    const cut = along > 18 && along < 29 ? 0.055 : along > 74 && along < 86 ? -0.051 : 0
    const top = shelf.shelf + entrance * 0.1 + cut
    const progress = Math.max(0, Math.min(1, (strata - top) / (0.84 - top)))
    const returnAt = shelf.neck + (shelf.foot - shelf.neck) * progress
    const rawWash = shoreWash(along)
    const wetAt = 0.8 + (along < returnAt - 7 ? 0.05 : -0.04) - (rawWash ? 0.09 : 0)
    if (strata > wetAt) {
      color = strata > 0.9 || along > returnAt + 3 ? rock.wet : rock.damp
    } else if (strata < top) {
      color = along < returnAt ? rock.mid : rock.turn
      if (strata < top - 0.09 && along > returnAt - 3) color = rock.joint
    } else if (along >= returnAt) {
      color = along > returnAt + 4 && strata < top + 0.26 ? rock.joint : rock.turn
    } else if (strata < top + shelf.cap) {
      const upperCap = spacing > 3 && along < returnAt - 5 && (along < 31 || along > 73)
      color = upperCap ? rock.cap : rock.sun
    } else {
      // The exposed front gets a second plane rather than repeating the same stripe under every cap.
      const underside = 0.58 + (along < shelf.from + 10 ? 0.05 : 0)
      color =
        strata < underside ? rock.sun : spacing < 7 || along > returnAt - 5 ? rock.turn : rock.mid
    }
  }
  return weight === 1
    ? color
    : shoreBlend(coastRock("sandstone", "left", depth, x, y, true, height), color, weight)
}

/** Two short ivory tips follow the face, surrounded by a receding teal shoal. */
function picnicShoreWater(x: number, y: number, drift: number, weight: number, along: number) {
  const wash = shoreWash(along)
  let color = drift === 1 ? "#365e61" : "#2d5963"
  if (wash) {
    const shoulder = along < wash.from + 1 || along > wash.to - 1
    if (drift === 1) {
      color = along >= wash.crestFrom && along <= wash.crestTo ? "#cdd2b3" : "#6d9385"
    } else if (drift === 2) {
      color = shoulder ? "#3b686b" : "#50817a"
    } else if (drift === 3 && !shoulder) {
      color = "#3b6d6d"
    }
  }
  return weight === 1 ? color : shoreBlend(shoreFoamColor(x, y, drift), color, weight)
}

/** Original-art pavers along the bay's walkway. */
export function coastPaving(u: number, v: number, grain: number, soil: string) {
  const lane = Math.floor(u * 3)
  const along = u * 3 - lane - 0.5
  const across = v - (lane % 2 ? 0.52 : 0.46)
  if (Math.abs(along) + Math.abs(across) * 0.75 > 0.52 || Math.abs(across) > 0.32) return soil
  return across > 0.24 || along > 0.36 ? "#a98e67" : grain > 0.78 ? "#e6d0a3" : "#cdb68b"
}

/** Painted under the land, so adjacent cells erase the internal shore automatically. */
export function paintCoastFoam(bitmap: Bitmap, frame: MapFrame, map: TileMap, slab: number) {
  const edges = [
    [1, 0, 1, 0, 1, 1, 1],
    [0, 1, 0, 1, 1, 1, -1],
    [-1, 0, 0, 0, 0, 1, -1],
    [0, -1, 0, 0, 1, 0, 1],
  ] as const
  for (const tile of map.tiles) {
    if (tile.kind === "void") continue
    for (const [dc, dr, u0, v0, u1, v1, side] of edges) {
      if (tileAt(map, tile.col + dc, tile.row + dr)) continue
      const a = isoToScreen(frame, tile.col + u0, tile.row + v0, -slab)
      const b = isoToScreen(frame, tile.col + u1, tile.row + v1, -slab)
      for (let i = 1; i < 16; i++) {
        const x = Math.round(a.x + ((b.x - a.x) * i) / 16)
        const y = Math.round(a.y + ((b.y - a.y) * i) / 16)
        const picnicShore = picnicShoreInfluence(map, tile, dc, dr, i / 16)
        for (let drift = 1; drift < 6; drift++) {
          const salt = hash(x, y + drift, 91)
          if (salt > 0.43 + drift / 20) {
            put(
              bitmap,
              x + side * drift,
              y + (dc + dr > 0 ? drift : -drift),
              map.art === "detailed"
                ? picnicShore
                  ? picnicShoreWater(x, y, drift, picnicShore, picnicShoreDistance(tile, i / 16))
                  : shoreFoamColor(x, y, drift)
                : salt > 0.91 && drift < 4
                  ? "#bfd5b7"
                  : "#4c8b83",
            )
          }
        }
      }
    }
  }
}

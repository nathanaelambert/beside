import type { CottageSpriteLevel } from "@beside/api-client"
import { rewardItems } from "@beside/rewards"

import { buoy, islandSign, jetty, rowboat, seaRock } from "./archipelagoProps"
import { put } from "./bitmap"
import { cottageLayers } from "./cottageDepth"
import { cottageStage, type CottageGrowthArt } from "./cottageGrowthArt"
import { jettyTimberGrade } from "./harborArt"
import { recolorTerrain } from "./islandPalettes"
import { mapFrame, screenToIso } from "./projection"
import { bush } from "./props"
import {
  avatarDrawable,
  houseDrawable,
  itemDrawable,
  sortDrawables,
  spriteDrawable,
  terrainDrawables,
  type Drawable,
} from "./scene"
import { makeTile, tileAt, tileMapFromRows, type TileMap } from "./tilemap"
import { detailedSpriteBitmap, type TreeArtStage } from "./worldDetailArt"
import { memberAvatarStyles } from "../pixel-world/avatars"
import { detailedAvatar } from "../pixel-world/detailedAvatars"

export type CoastCell = { col: number; row: number }
const coast = tileMapFromRows([
  "...fffff....",
  "..fggggff...",
  ".fgggggggf..",
  ".ggggppppgg.",
  ".ggbbgg..gg.",
  ".fgggg....g.",
  ".ggggg......",
  "..ggggg.....",
  "..ggggg.....",
  "...ggg......",
  "............",
])

export const bayFrame = mapFrame(coast.cols, coast.rows, { side: 16, top: 51, bottom: 24 })
export const bayFocus = { u: 5.1, v: 4.5 }
export const bayHouse = { col: 3, row: 3 }
export const bayJetty = { u: 11, v: 3.5, lift: 0 }
export const maxBayAdditions = 12
export const bayStyles = {
  terracotta: {
    label: "Terracotta",
    roof: "clay",
    material: "sandstone",
    item: "pink-tulip",
    palette: 0,
  },
  woodland: { label: "Woodland", roof: "teal", material: "granite", item: "oak-tree", palette: 2 },
  plum: { label: "Plum", roof: "plum", material: "slate", item: "pink-tulip", palette: 3 },
  moss: { label: "Moss", roof: "moss", material: "granite", item: "lavender", palette: 2 },
  clubhouse: {
    label: "Clubhouse",
    roof: "slate",
    material: "slate",
    item: "stone-lantern",
    palette: 3,
  },
} as const
export type BayStyle = keyof typeof bayStyles
export type BayArtAssets = { cottages: CottageGrowthArt; jetty: number }
export type BayView = "bay" | "garden" | "harbor"
export const bayGardenItems = rewardItems

type BaySceneOptions = {
  assets?: BayArtAssets
  view?: BayView
  sampleId?: string
  treeStage?: TreeArtStage
}

const memberSpots = [
  { u: 2.6, v: 4.4 },
  { u: 3.05, v: 5.85 },
  { u: 4.25, v: 5.5 },
  { u: 5.1, v: 5.1 },
] as const
const visitors = memberAvatarStyles.map((avatar, i) => ({ ...avatar, name: `Visitor ${i + 1}` }))
const detailedVisitors = visitors.map(detailedAvatar)
const harborProps = [
  {
    id: "boat",
    sprite: (detailed: boolean) => rowboat(0, "se", detailed),
    u: 8.25,
    v: 5.9,
    lift: -3,
  },
  { id: "buoy", sprite: (detailed: boolean) => buoy(0, detailed), u: 8.8, v: 7.35, lift: -3 },
  {
    id: "sea-rock",
    sprite: (detailed: boolean) => seaRock(0.68, detailed),
    u: 7.85,
    v: 9,
    lift: -3,
  },
  {
    id: "sign",
    sprite: (detailed: boolean) => islandSign("Beside Bay", false, detailed),
    u: 7.5,
    v: 2.4,
    lift: 0,
  },
] as const

const blossoms = {
  terracotta: ["#ba6575", "#f2afb3"],
  woodland: ["#b5a759", "#f2dea1"],
  plum: ["#9d6383", "#e5a8c4"],
  moss: ["#9e6bb0", "#d8b2ec"],
  clubhouse: ["#8874ad", "#d6c6eb"],
} as const
const flowerBeds = Object.fromEntries(
  (Object.keys(bayStyles) as BayStyle[]).map((style) => {
    const shrub = bush(0.65)
    const [dark, light] = blossoms[style]
    for (const [x, y] of [
      [5, 8],
      [9, 5],
      [12, 8],
      [14, 6],
    ]) {
      put(shrub.bitmap, x + 1, y, dark)
      put(shrub.bitmap, x, y + 1, dark)
      put(shrub.bitmap, x, y, light)
    }
    return [style, shrub] as const
  }),
)

const neighbors = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const
export const bayCellKey = ({ col, row }: CoastCell) => `${col}:${row}`
const same = (a: CoastCell, b: CoastCell) => a.col === b.col && a.row === b.row
export const bayCellAt = (x: number, y: number): CoastCell => {
  const { u, v } = screenToIso(bayFrame, x, y)
  return { col: Math.floor(u), row: Math.floor(v) }
}

export function bayCandidates(additions: readonly CoastCell[]) {
  if (additions.length >= maxBayAdditions) return []
  const land = (col: number, row: number) =>
    !!tileAt(coast, col, row) || additions.some((cell) => same(cell, { col, row }))
  return coast.tiles
    .filter(
      ({ col, row, kind }) =>
        kind === "void" &&
        !land(col, row) &&
        // Keep the pier's approach and the mouth of the bay open.
        !(col >= 8 && row >= 2 && row <= 8) &&
        neighbors.some(([dc, dr]) => land(col + dc, row + dr)),
    )
    .map(({ col, row }) => ({ col, row }))
    .sort(
      (a, b) =>
        Math.abs(a.col - 6) + Math.abs(a.row - 6) - (Math.abs(b.col - 6) + Math.abs(b.row - 6)) ||
        a.row - b.row ||
        a.col - b.col,
    )
}

export function addBayCell(additions: CoastCell[], candidate: CoastCell): CoastCell[] {
  return bayCandidates(additions).some((cell) => same(cell, candidate))
    ? [...additions, candidate]
    : additions
}

export function readBayAdditions(value: unknown): CoastCell[] {
  if (!Array.isArray(value)) return []
  let additions: CoastCell[] = []
  for (const cell of value.slice(0, maxBayAdditions)) {
    if (typeof cell?.col !== "number" || typeof cell?.row !== "number") continue
    if (Number.isInteger(cell.col) && Number.isInteger(cell.row))
      additions = addBayCell(additions, { col: cell.col, row: cell.row })
  }
  return additions
}

export function bayTerrain(
  cells: readonly CoastCell[],
  style: BayStyle,
  detailed = false,
): TileMap {
  const tiles = coast.tiles.slice()
  for (const { col, row } of cells) tiles[row * coast.cols + col] = makeTile(col, row, "grass")
  return {
    ...coast,
    tiles,
    coast: bayStyles[style].material,
    art: detailed ? "detailed" : undefined,
  }
}

export function buildBayScene(
  map: TileMap,
  style: BayStyle,
  level: CottageSpriteLevel,
  { assets, view = "bay", sampleId = "oak-tree", treeStage = "mature" }: BaySceneOptions = {},
) {
  const { roof, item, palette } = bayStyles[style]
  const frame = bayFrame
  const detailed = map.art === "detailed"
  const terracottaAssets = detailed && style === "terracotta" ? assets : undefined
  const cottage = houseDrawable(
    frame,
    map,
    "bay",
    bayHouse.col,
    bayHouse.row,
    roof,
    true,
    level,
    detailed ? assets?.cottages : undefined,
  )
  const pier = spriteDrawable(frame, "bay-jetty", jetty(detailed), bayJetty, {
    artAsset: terracottaAssets?.jetty,
    artColorMatrix: terracottaAssets ? jettyTimberGrade : undefined,
  })
  const decoration = (key: string, id: string, u: number, v: number, stage?: TreeArtStage) =>
    itemDrawable(frame, map, key, id, u, v, { hit: undefined }, stage)
  const oak = decoration("bay-oak", "oak-tree", 2.75, 2.15)
  const extraDrawables: (Drawable | undefined)[] = []
  if (view === "garden") {
    extraDrawables.push(decoration("bay-sample", sampleId, 4.15, 7.5, treeStage))
  } else if (view === "harbor") {
    for (const prop of harborProps) {
      const drawable = spriteDrawable(frame, `bay-harbor-${prop.id}`, prop.sprite(detailed), prop)
      extraDrawables.push(
        prop.id === "sea-rock" ? drawable : refineDecoration(drawable, detailed, prop.id),
      )
    }
  } else {
    const roster = detailed ? detailedVisitors : visitors
    for (const [index, { u, v }] of memberSpots.entries()) {
      extraDrawables.push({ ...avatarDrawable(frame, map, roster[index]!, u, v), hit: undefined })
    }
  }
  const terrain = recolorTerrain(
    terrainDrawables(map, frame, new Set([bayCellKey(bayHouse)]), 19),
    palette,
  )
  const drawables = sortDrawables(
    [
      ...terrain,
      ...cottageLayers(
        cottage,
        cottageStage(roof, level, detailed ? assets?.cottages : undefined)?.depthLayers,
      ),
      pier,
      oak,
      decoration("bay-blooms", "pink-tulip", 2.1, 5.8),
      decoration("bay-lantern", "stone-lantern", 9.4, 3.6),
      decoration("bay-style", item, 6.45, 2.6),
      ...[
        [1.85, 4.75],
        [5.8, 7.8],
        [9, 5.3],
        [7.5, 3.9],
      ].map(([u, v], i) =>
        refineDecoration(
          spriteDrawable(
            frame,
            `bay-blossoms-${i}`,
            flowerBeds[style]!,
            { u, v, lift: 0 },
            {
              foliage: detailed ? "shrub" : undefined,
            },
          ),
          detailed,
          "nature",
        ),
      ),
      ...extraDrawables,
    ].filter((d): d is Drawable => !!d),
  )
  return { key: "bay-workshop", frame, map, drawables, palette, offset: { x: 0, y: 0 } }
}

function refineDecoration(
  drawable: Drawable,
  detailed: boolean,
  kind: Parameters<typeof detailedSpriteBitmap>[1],
): Drawable {
  if (!detailed) return drawable
  const { source } = drawable
  if (source.type === "bitmap") {
    return { ...drawable, source: { ...source, bitmap: detailedSpriteBitmap(source.bitmap, kind) } }
  }
  return drawable
}

import { cottageLevel, type cottageConstruction, type CottageSpriteLevel } from "@beside/api-client"
import type { PixelArt } from "@beside/rewards"
import { rewardItems } from "@beside/rewards"

import { bayCottageArt } from "./bayCottageArt"
import { hash, type Bitmap } from "./bitmap"
import { pocketWatchArt } from "./cottageClockArt"
import { cottageStage, type CottageGrowthArt } from "./cottageGrowthArt"
import { flowerFamilyArt } from "./flowerFamilyArt"
import type { FoliageKind } from "./foliageWind"
import { meadowShrub } from "./meadowArt"
import { isRaised, paintBlock } from "./paint"
import { readingBenchTexture } from "./picnicArt"
import {
  depthOf,
  isoToScreen,
  mapFrame,
  meadowToIso,
  screenToIso,
  type MapFrame,
} from "./projection"
import { bush, house, rock, roofColorOrder, type RoofColor, type Sprite } from "./props"
import { meadowTileMap, tileAt, tileMapFromRows, type TileMap } from "./tilemap"
import { treeFamilyArt, type TreeFamilyId } from "./treeFamilyArt"
import { detailedCatalogArt, type TreeArtStage } from "./worldDetailArt"
import { AVATAR_HEIGHT, AVATAR_WIDTH, type Avatar } from "../pixel-world/avatars"

export const catalogue = new Map(rewardItems.map((item) => [item.id, item]))

export type HitTarget =
  | { type: "avatar"; id: string }
  | { type: "house"; id: string }
  | { type: "item"; id: string; itemId: string }

export type DrawableSource =
  | { type: "bitmap"; bitmap: Bitmap }
  | { type: "art"; art: PixelArt }
  | { type: "avatar"; avatar: Avatar }

export interface Drawable {
  key: string
  source: DrawableSource
  /** Optional visual-only replacement, fitted to the source's existing sprite bounds. */
  artAsset?: number
  /** RGB finish for a loaded texture; the authored bitmap is the unfiltered fallback. */
  artColorMatrix?: number[]
  artRows?: readonly number[]
  treeArt?: { id: TreeFamilyId; stage: TreeArtStage }
  /** Visual-only idle motion; the saved anchor and hit target are unchanged. */
  foliage?: FoliageKind
  /** Painter's order; larger draws later (nearer). */
  depth: number
  /** Top-left in map-frame pixels. */
  x: number
  y: number
  width: number
  height: number
  /** Ground contact point (for shadows and hit padding). */
  baseX: number
  baseY: number
  /** Width of the soft ground shadow, if any. */
  shadow?: number
  /** Topmost opaque row, for the selection pointer. */
  top: number
  opacity?: number
  hit?: HitTarget
}

/** World position of a scene object, in tile units, with optional elevation. */
interface Placed {
  u: number
  v: number
  lift: number
}

function liftAt(map: TileMap, u: number, v: number) {
  return Math.max(0, tileAt(map, Math.floor(u), Math.floor(v))?.lift ?? 0)
}

// --- Cached bitmaps --------------------------------------------------------------------------

const blockCache = new WeakMap<TileMap, Map<number, ReturnType<typeof paintBlock>>>()
function blockFor(map: TileMap, frame: MapFrame, index: number) {
  let cache = blockCache.get(map)
  if (!cache) blockCache.set(map, (cache = new Map()))
  let block = cache.get(index)
  if (!block) cache.set(index, (block = paintBlock(map, frame, map.tiles[index]!)))
  return block
}
const spriteCache = new Map<string, Sprite>()
function cachedSprite(key: string, make: () => Sprite) {
  let sprite = spriteCache.get(key)
  if (!sprite) spriteCache.set(key, (sprite = make()))
  return sprite
}
export const houseSprite = (roof: RoofColor, lit: boolean, level: CottageSpriteLevel = 1) =>
  cachedSprite(`house-${roof}-${lit}-${level}`, () => house(roof, lit, level))

// --- Building blocks -------------------------------------------------------------------------

export function spriteDrawable(
  frame: MapFrame,
  key: string,
  sprite: Sprite,
  at: Placed,
  extra: Partial<Drawable> = {},
): Drawable {
  const base = isoToScreen(frame, at.u, at.v, at.lift)
  const x = Math.round(base.x - sprite.anchorX)
  const y = Math.round(base.y - sprite.anchorY)
  return {
    key,
    source: { type: "bitmap", bitmap: sprite.bitmap },
    depth: depthOf(at.u, at.v),
    x,
    y,
    width: sprite.bitmap.width,
    height: sprite.bitmap.height,
    baseX: Math.round(base.x),
    baseY: Math.round(base.y),
    top: y + topRow(sprite.bitmap),
    ...extra,
  }
}

function topRow(bitmap: Bitmap) {
  for (let y = 0; y < bitmap.height; y++)
    for (let x = 0; x < bitmap.width; x++) if (bitmap.rgba[(y * bitmap.width + x) * 4 + 3]) return y
  return 0
}

const artTops = new Map<PixelArt, number>()
function artTop(art: PixelArt) {
  let top = artTops.get(art)
  if (top === undefined) {
    top = Math.max(
      0,
      art.pixels.findIndex((row) => /[^.]/.test(row)),
    )
    artTops.set(art, top)
  }
  return top
}

export function itemDrawable(
  frame: MapFrame,
  map: TileMap,
  key: string,
  itemId: string,
  u: number,
  v: number,
  extra: Partial<Drawable> = {},
  growthStage?: TreeArtStage,
): Drawable | undefined {
  const item = catalogue.get(itemId)
  if (!item) return undefined
  const art = (map.art === "detailed" && detailedCatalogArt(itemId, growthStage)) || item.artifact
  const tree = map.art === "detailed" ? treeFamilyArt(itemId, growthStage) : undefined
  const flower = map.art === "detailed" ? flowerFamilyArt(itemId, growthStage) : undefined
  const bench =
    map.art === "detailed" && itemId === "reading-bench" ? readingBenchTexture : undefined
  const rows = tree?.rows ?? flower?.rows
  const lift = liftAt(map, u, v)
  const base = isoToScreen(frame, u, v, lift)
  const x = Math.round(base.x - 16)
  const y = Math.round(base.y - 31)
  const foliage: FoliageKind | undefined =
    map.art === "detailed" && extra.opacity === undefined
      ? item.category === "Trees"
        ? "tree"
        : item.category === "Flowers"
          ? "flower"
          : undefined
      : undefined
  return {
    key,
    source: { type: "art", art },
    foliage,
    artAsset: flower?.asset ?? bench,
    treeArt: tree && { id: tree.id, stage: tree.stage },
    artRows: rows,
    depth: depthOf(u, v),
    x,
    y,
    width: 32,
    height: 32,
    baseX: Math.round(base.x),
    baseY: Math.round(base.y),
    shadow: 18,
    top: y + (rows ? rows.findIndex(Boolean) : artTop(art)),
    hit: { type: "item", id: key, itemId },
    ...extra,
  }
}

export function avatarDrawable(
  frame: MapFrame,
  map: TileMap,
  avatar: Avatar,
  u: number,
  v: number,
) {
  const lift = liftAt(map, u, v)
  const base = isoToScreen(frame, u, v, lift)
  const x = Math.round(base.x - AVATAR_WIDTH / 2)
  const y = Math.round(base.y - AVATAR_HEIGHT + 1)
  return {
    key: `avatar-${avatar.key}`,
    source: { type: "avatar", avatar },
    depth: depthOf(u, v),
    x,
    y,
    width: AVATAR_WIDTH,
    height: AVATAR_HEIGHT,
    baseX: Math.round(base.x),
    baseY: Math.round(base.y),
    shadow: 12,
    top: y,
    hit: { type: "avatar", id: avatar.key },
  } satisfies Drawable
}

export function houseDrawable(
  frame: MapFrame,
  map: TileMap,
  key: string,
  col: number,
  row: number,
  roof: RoofColor,
  lit: boolean,
  level: CottageSpriteLevel = 1,
  cottages?: CottageGrowthArt,
) {
  const tile = tileAt(map, col, row)
  const image = cottageStage(roof, level, cottages)
  const spriteLevel = image && level === 0 ? 1 : level
  const result = spriteDrawable(
    frame,
    `house-${key}`,
    map.art === "detailed" || image
      ? bayCottageArt(roof, spriteLevel, lit)
      : houseSprite(roof, lit, level),
    { u: col + 0.5, v: row + 0.5, lift: Math.max(0, tile?.lift ?? 0) },
    { hit: { type: "house", id: key } },
  )
  return image
    ? {
        ...result,
        artAsset: image.asset,
        artRows: image.rows,
        top: result.y + Math.max(0, image.rows.findIndex(Boolean)),
      }
    : result
}

/** Raised tiles, plus trees, bushes and rocks on the forest rim (skipping reserved lots). */
export function terrainDrawables(
  map: TileMap,
  frame: MapFrame,
  reserved: Set<string> = new Set(),
  variantSeed = 0,
): Drawable[] {
  const result: Drawable[] = []
  const detailed = map.art === "detailed"
  const salt = Math.floor(variantSeed * 1000000)
  map.tiles.forEach((tile, index) => {
    if (!isRaised(tile)) return
    const block = blockFor(map, frame, index)
    result.push({
      key: `block-${tile.col}-${tile.row}`,
      source: { type: "bitmap", bitmap: block.bitmap },
      // Behind anything standing on this tile, in front of anything on the tiles behind it.
      depth: tile.col + tile.row + 0.5,
      x: block.x,
      y: block.y,
      width: block.bitmap.width,
      height: block.bitmap.height,
      baseX: block.x + block.bitmap.width / 2,
      baseY: block.y,
      top: block.y,
    })
    if (tile.kind !== "forest" || reserved.has(`${tile.col},${tile.row}`)) return
    const front = tile.row === map.rows - 1 || tile.col === map.cols - 1
    const roll = variantSeed ? hash(tile.col, tile.row, salt) : tile.seed
    const jitterU = (hash(tile.col, tile.row, 51 + salt) - 0.5) * 0.3
    const jitterV = (hash(tile.col, tile.row, 52 + salt) - 0.5) * 0.3
    const at = { u: tile.col + 0.5 + jitterU, v: tile.row + 0.5 + jitterV, lift: tile.lift }
    const key = `prop-${tile.col}-${tile.row}`
    if (!front && roll < 0.78) {
      const itemId = hash(tile.col, tile.row, 53 + salt) > 0.45 ? "pine-tree" : "oak-tree"
      const tree = itemDrawable(frame, map, key, itemId, at.u, at.v, { hit: undefined })
      if (tree) result.push(tree)
    } else if (roll < 0.86 || (front && roll < 0.5)) {
      const shrub = cachedSprite(`bush-${roll > 0.7}`, () => bush(roll > 0.7 ? 0.8 : 0.2))
      result.push(
        detailed
          ? spriteDrawable(frame, key, { ...shrub, bitmap: meadowShrub(shrub.bitmap) }, at, {
              foliage: "shrub",
            })
          : spriteDrawable(frame, key, shrub, at),
      )
    } else if (front ? roll < 0.75 : true) {
      result.push(
        spriteDrawable(
          frame,
          key,
          cachedSprite(`rock-${roll > 0.9}-${detailed}`, () =>
            rock(roll > 0.9 ? 0.8 : 0.1, detailed),
          ),
          at,
        ),
      )
    }
  })
  return result
}

export function sortDrawables(drawables: Drawable[]) {
  return [...drawables].sort((a, b) => a.depth - b.depth || a.baseX - b.baseX)
}

export function opaqueAt(d: Drawable, x: number, y: number) {
  const px = Math.floor(x - d.x)
  const py = Math.floor(y - d.y)
  if (px < 0 || py < 0 || px >= d.width || py >= d.height) return false
  if (d.artRows) {
    const span = d.artRows[py] ?? 0
    return px >= span >> 7 && px < (span & 127)
  }
  const { source } = d
  if (source.type === "bitmap")
    return source.bitmap.rgba[(py * source.bitmap.width + px) * 4 + 3] !== 0
  const art = source.type === "art" ? source.art : source.avatar.frames.idle
  const row = art.pixels[Math.floor((py * art.pixels.length) / d.height)]
  return !!row && (row[Math.floor((px * row.length) / d.width)] ?? ".") !== "."
}

/**
 * Front-most hit target under a map-frame point. A tap on visible pixels always wins, so a
 * cottage's transparent corners never steal a friend standing beside it. Otherwise small
 * sprites get padded boxes so every target is at least `minSize` art pixels (44pt).
 */
export function hitTest(drawables: Drawable[], x: number, y: number, minSize: number) {
  const candidates = drawables.filter((d) => d.hit).sort((a, b) => b.depth - a.depth)
  const exact = candidates.find((d) => opaqueAt(d, x, y))
  if (exact) return exact.hit
  // Padded boxes, nearest anchor first, for anything smaller than a fingertip.
  return candidates
    .filter((d) => {
      const padX = Math.max(0, (minSize - d.width) / 2)
      const top = Math.min(d.top, d.baseY - minSize)
      return x >= d.x - padX && x <= d.x + d.width + padX && y >= top && y <= d.baseY + 3
    })
    .sort((a, b) => Math.abs(a.baseX - x) - Math.abs(b.baseX - x))[0]?.hit
}

// --- The home base island --------------------------------------------------------------------

/**
 * Lawn lots inside the protected picnic area (the shared oak rule never allows planting
 * there), chosen so no cottage hides a friend or a decoration. Then the back rim.
 */
export const HOUSE_LOTS: [number, number][] = [
  [7, 10],
  [10, 12],
  [6, 11],
  [9, 13],
  [8, 10],
  [6, 1],
  [8, 1],
  [11, 1],
  [4, 1],
]
export interface HomeActivity {
  id: string
  name: string
  /** A milestone window is open right now. */
  open?: boolean
  cottageMilestones?: number
  construction?: ReturnType<typeof cottageConstruction>
}

export type HomeGardenItem = {
  key: string
  itemId: string
  x: number
  y: number
  stage?: TreeArtStage
}

export interface HomeSceneInput {
  variantSeed?: number
  avatars: Avatar[]
  /** Decorations in meadow pixels (bottom-centre anchors). */
  items: HomeGardenItem[]
  activities?: HomeActivity[]
  assets?: { cottages: CottageGrowthArt }
}

// Same land cells/elevation and frame; opt into the bay's material treatment.
const detailedHomeMap: TileMap = {
  ...meadowTileMap(),
  art: "detailed",
  coast: "sandstone",
  coastFinish: "picnic-headland",
}

export const homeFrame = (() => {
  const map = meadowTileMap()
  return mapFrame(map.cols, map.rows)
})()

export function houseLots(activities: HomeActivity[]) {
  return activities.slice(0, HOUSE_LOTS.length).map((activity, index) => ({
    activity,
    col: HOUSE_LOTS[index]![0],
    row: HOUSE_LOTS[index]![1],
    roof: roofColorOrder[index % roofColorOrder.length]!,
  }))
}

/**
 * Friends stand along the back of the blanket in the iso view, so cottages in front of the
 * picnic never hide them. Extra rows (more than four members) step forward.
 */
export const homeAvatarY = (y: number) => 135 + (y - 147) / 2

function constructionWatch(
  cottage: Drawable,
  level: CottageSpriteLevel,
  seconds: number,
): Drawable {
  const art = pocketWatchArt(seconds)
  const y = level === 0 && !cottage.artRows ? cottage.baseY - 26 : cottage.top - 1
  return {
    key: `${cottage.key}-clock`,
    source: { type: "art", art },
    depth: cottage.depth + 0.01,
    x: cottage.baseX + 11,
    y,
    width: art.pixels[0].length,
    height: art.pixels.length,
    baseX: cottage.baseX,
    baseY: cottage.baseY,
    top: y,
  }
}

export function buildHomeScene({
  avatars,
  items,
  activities = [],
  variantSeed = 0,
  assets,
}: HomeSceneInput) {
  const map = detailedHomeMap
  const frame = homeFrame
  const houses = houseLots(activities)
  const reserved = new Set([...houses.map(({ col, row }) => `${col},${row}`)])
  const drawables: Drawable[] = [
    ...terrainDrawables(map, frame, reserved, variantSeed),
    ...items.flatMap((item) => {
      const { u, v } = meadowToIso(item.x, item.y)
      return itemDrawable(frame, map, item.key, item.itemId, u, v, {}, item.stage) ?? []
    }),
    ...avatars.map((avatar) => {
      const { u, v } = meadowToIso(avatar.x, homeAvatarY(avatar.y))
      return avatarDrawable(frame, map, avatar, u, v)
    }),
    ...houses.flatMap(({ activity, col, row, roof }) => {
      const level = activity.construction?.level ?? cottageLevel(activity.cottageMilestones)
      const cottage = houseDrawable(
        frame,
        map,
        activity.id,
        col,
        row,
        roof,
        !!activity.open,
        level,
        assets?.cottages,
      )
      return activity.construction?.building
        ? [cottage, constructionWatch(cottage, level, activity.construction.seconds)]
        : [cottage]
    }),
  ]
  return { map, frame, drawables: sortDrawables(drawables), houses }
}

/** Map-frame pixel to meadow pixel, on the ground plane. */
export function frameToMeadow(frame: MapFrame, x: number, y: number) {
  const { u, v } = screenToIso(frame, x, y)
  return { x: u * 16, y: v * 16 }
}

// --- An activity's own plot (activity screen header) -----------------------------------------

const plotMap = tileMapFromRows(["ffggf", "fgggg", "ggpgg", "ggpgg"])
const plotFrame = mapFrame(plotMap.cols, plotMap.rows, { top: 64, side: 8, bottom: 22 })
/** Where friends who checked in gather: in front of the door, then along the path. */
const PLOT_SPOTS: [number, number][] = [
  [2.35, 2.25],
  [1.55, 2.6],
  [3.2, 2.15],
  [2.5, 3.2],
  [1.5, 3.5],
  [3.5, 3.1],
  [0.7, 2.9],
  [4.2, 2.6],
]

export function buildActivityScene({
  roof,
  lit,
  level = 1,
  constructionSeconds = 0,
  attendees,
  cottages,
}: {
  roof: RoofColor
  lit: boolean
  level?: CottageSpriteLevel
  constructionSeconds?: number
  attendees: Avatar[]
  cottages?: CottageGrowthArt
}) {
  const cottage = houseDrawable(plotFrame, plotMap, "plot", 1, 1, roof, lit, level, cottages)
  const drawables: Drawable[] = [
    ...terrainDrawables(plotMap, plotFrame, new Set(["1,1"])),
    cottage,
    ...(constructionSeconds > 0 ? [constructionWatch(cottage, level, constructionSeconds)] : []),
    ...attendees.slice(0, PLOT_SPOTS.length).map((avatar, index) => {
      const [u, v] = PLOT_SPOTS[index]!
      return avatarDrawable(plotFrame, plotMap, avatar, u, v)
    }),
  ]
  return { map: plotMap, frame: plotFrame, drawables: sortDrawables(drawables) }
}

/** Each activity keeps the roof colour of its cottage on the home island. */
export function roofForIndex(index: number): RoofColor {
  return roofColorOrder[Math.max(0, index) % roofColorOrder.length]!
}

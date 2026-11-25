import {
  homeExpansionFirstColumn,
  homeExpansionLastColumn,
  isHomeExpansionTile,
  type HomeCoastTile,
} from "@beside/api-client/homebase-expansion"

import type { IslandLayer } from "./archipelago"
import { coastHeight } from "./coastAccess"
import { recolorTerrain } from "./islandPalettes"
import { paintBlock } from "./paint"
import type { MapFrame } from "./projection"
import type { Drawable } from "./scene"
import { makeTile, tileAt, type Tile, type TileMap } from "./tilemap"

export const homeCoastCenter = ({ col, row }: HomeCoastTile) => ({ u: col + 0.5, v: row + 0.5 })

export function homeCoastTerrain(map: TileMap, additions: readonly HomeCoastTile[]): TileMap {
  if (!additions.length) return map
  const coastTiles = additions
    .filter((tile) => isHomeExpansionTile(tile) && !tileAt(map, tile.col, tile.row))
    .map(({ col, row }) => ({ ...makeTile(col, row, "grass"), lift: coastHeight }))
  return coastTiles.length
    ? { ...map, coastTiles: [...(map.coastTiles ?? []), ...coastTiles] }
    : map
}

const previewMaps = new WeakMap<TileMap, Map<number, TileMap>>()
const coastBlocks = new WeakMap<TileMap, Drawable[]>()

function coastBlock(map: TileMap, frame: MapFrame, tile: Tile): Drawable {
  const { bitmap, x, y } = paintBlock(map, frame, tile)
  return {
    key: `block-${tile.col}-${tile.row}`,
    source: { type: "bitmap", bitmap },
    depth: tile.col + tile.row + 0.5,
    x,
    y,
    width: bitmap.width,
    height: bitmap.height,
    baseX: x + bitmap.width / 2,
    baseY: y,
    top: y,
  }
}

export function coastDrawables(map: TileMap, frame: MapFrame) {
  if (!map.coastTiles?.length) return []
  let blocks = coastBlocks.get(map)
  if (!blocks) {
    blocks = map.coastTiles.map((tile) => coastBlock(map, frame, tile))
    coastBlocks.set(map, blocks)
  }
  return blocks
}

/** Paint the actual proposed shape without changing the shared model or moving any drawable. */
export function previewHomeCoast(layer: IslandLayer, tile: HomeCoastTile): IslandLayer {
  let previews = previewMaps.get(layer.map)
  if (!previews) previewMaps.set(layer.map, (previews = new Map()))
  let map = previews.get(tile.col)
  if (!map) {
    map = homeCoastTerrain(layer.map, [tile])
    previews.set(tile.col, map)
  }
  if (map === layer.map) return layer
  // Repaint the moved cliff contour and the same rim finish available after confirmation.
  const repaint = coastDrawables(map, layer.frame).slice()
  for (let col = homeExpansionFirstColumn; col <= homeExpansionLastColumn; col++) {
    const rim = tileAt(map, col, map.rows - 1)
    if (rim?.lift) repaint.push(coastBlock(map, layer.frame, rim))
  }
  const repaintKeys = new Set(repaint.map((block) => block.key))
  const drawables = [
    ...layer.drawables.filter((drawable) => !repaintKeys.has(drawable.key)),
    ...recolorTerrain(repaint, layer.palette ?? 0),
  ].sort((a, b) => a.depth - b.depth || a.baseX - b.baseX)
  return { ...layer, map, drawables }
}

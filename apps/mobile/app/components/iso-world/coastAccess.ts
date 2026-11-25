import { LEVEL } from "./projection"
import { tileAt, type TileMap } from "./tilemap"

/** The original limestone path ends here. Neither cottage lots nor decorations use it. */
export const coastStair = {
  col: 8,
  row: 13,
  left: 8.49,
  right: 9,
  back: 13.05,
  front: 14,
  walkingU: 8.965,
} as const

/** Both lanes run outside the forest props' ±0.15 jitter around each tile's centre. */
export const coastRimV = 14.965
export const coastHeight = LEVEL

export const coastRampLift = (v: number) =>
  coastHeight *
  Math.max(0, Math.min(1, (v - coastStair.back) / (coastStair.front - coastStair.back)))

export function walkSurfaceLift(map: TileMap, u: number, v: number) {
  if (
    map.coastTiles?.length &&
    u >= coastStair.left &&
    u < coastStair.right &&
    v >= coastStair.back &&
    v < coastStair.front
  )
    return coastRampLift(v)
  return tileAt(map, Math.floor(u), Math.floor(v))?.lift ?? 0
}

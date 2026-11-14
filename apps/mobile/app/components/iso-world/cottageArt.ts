import type { PixelArt } from "@beside/rewards"

import { bitmapToPixelArt } from "./bitmap"
import { houseSprite, roofForIndex } from "./scene"

const cache = new Map<string, PixelArt>()

/** An activity's cottage as plain pixel art, for lists and thumbnails outside the canvas. */
export function cottageArt(index: number, lit = false): PixelArt {
  const roof = roofForIndex(index)
  const key = `${roof}-${lit}`
  let art = cache.get(key)
  if (!art) cache.set(key, (art = bitmapToPixelArt(houseSprite(roof, lit).bitmap)))
  return art
}

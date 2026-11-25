import { COTTAGE_MILESTONE_CAP, cottageLevel, type CottageSpriteLevel } from "@beside/api-client"
import type { PixelArt } from "@beside/rewards"

import { bayCottageArt } from "./bayCottageArt"
import { bitmapToPixelArt } from "./bitmap"
import { houseSprite, roofForIndex } from "./scene"

const cache = new Map<string, PixelArt>()

/** An activity's cottage as plain pixel art, for lists and thumbnails outside the canvas. */
export function cottageArt(
  index: number,
  lit = false,
  level: CottageSpriteLevel = 1,
  detailed = false,
): PixelArt {
  const roof = roofForIndex(index)
  const key = `${roof}-${lit}-${level}-${detailed}`
  let art = cache.get(key)
  if (!art) {
    const sprite = detailed ? bayCottageArt(roof, level, lit) : houseSprite(roof, lit, level)
    cache.set(key, (art = bitmapToPixelArt(sprite.bitmap)))
  }
  return art
}

export function cottageProgressLabel(milestones = 0, level = cottageLevel(milestones)) {
  if (level === 3) return `Level ${level} of 3 · Fully built`
  if (level === 1) return "Level 1 of 3 · Complete 1 milestone to upgrade"
  return `Level ${level} of 3 · ${milestones} of ${COTTAGE_MILESTONE_CAP} milestones`
}

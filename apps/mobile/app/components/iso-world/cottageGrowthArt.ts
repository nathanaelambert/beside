import type { CottageSpriteLevel } from "@beside/api-client"

import type { RoofColor } from "./props"

export type CottageDepthLayers = {
  rear: number
  /** Omit when the main texture already contains only the facade. */
  front?: number
  /** Visible rear bounds in logical pixels, right and bottom exclusive. */
  bounds: readonly [left: number, top: number, right: number, bottom: number]
}

export type CottageImage = {
  asset: number
  /** One horizontal occupied span per logical row, encoded as start << 7 | end. */
  rows: readonly number[]
  /** Visual layers for a rear extension when another cottage overlaps its projection. */
  depthLayers?: CottageDepthLayers
}

export type CottageArtSeries = Readonly<Record<1 | 2 | 3, CottageImage>>
export type CottageGrowthArt = Readonly<Partial<Record<RoofColor, CottageArtSeries>>>

/** The initial clock and completed level 1 share one fixed starter house. */
export function cottageStage(roof: RoofColor, level: CottageSpriteLevel, art?: CottageGrowthArt) {
  return art?.[roof]?.[level === 0 ? 1 : level]
}

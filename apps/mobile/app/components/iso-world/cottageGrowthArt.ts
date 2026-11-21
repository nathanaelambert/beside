import type { CottageSpriteLevel } from "@beside/api-client"

import type { RoofColor } from "./props"

export type CottageImage = {
  asset: number
  /** One horizontal occupied span per logical row, encoded as start << 7 | end. */
  rows: readonly number[]
}

export type CottageArtSeries = Readonly<Record<1 | 2 | 3, CottageImage>>
export type CottageGrowthArt = Readonly<Partial<Record<RoofColor, CottageArtSeries>>>

/** The initial clock and completed level 1 share one fixed starter house. */
export function cottageStage(roof: RoofColor, level: CottageSpriteLevel, art?: CottageGrowthArt) {
  return art?.[roof]?.[level === 0 ? 1 : level]
}

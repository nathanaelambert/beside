import { Image } from "react-native"
import type { CottageSpriteLevel } from "@beside/api-client"

import { PixelArtSprite, snapScale } from "./BesideMark"
import { cottageArt } from "./iso-world/cottageArt"
import { cottageStage } from "./iso-world/cottageGrowthArt"
import { roofForIndex } from "./iso-world/scene"
import { worldArtAssets } from "./iso-world/worldArtAssets"

export function CottageThumbnail({
  index,
  lit = false,
  level = 1,
  detailed = false,
}: {
  index: number
  lit?: boolean
  level?: CottageSpriteLevel
  detailed?: boolean
}) {
  const image = cottageStage(roofForIndex(index), level, worldArtAssets.cottages)
  const scale = snapScale(1)
  return image ? (
    <Image
      testID="cottage-growth-thumbnail"
      source={image.asset}
      resizeMode="contain"
      fadeDuration={0}
      style={{ width: 64 * scale, height: 70 * scale }}
    />
  ) : (
    <PixelArtSprite art={cottageArt(index, lit, level, detailed)} scale={1} />
  )
}

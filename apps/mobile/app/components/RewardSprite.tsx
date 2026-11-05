import { memo } from "react"
import type { RewardItem } from "@beside/rewards"

import { PixelArtSprite } from "@/components/BesideMark"

export const RewardSprite = memo(function RewardSprite({
  item,
  scale = 3,
}: {
  item: RewardItem
  scale?: number
}) {
  return <PixelArtSprite art={item.artifact} scale={scale} />
})

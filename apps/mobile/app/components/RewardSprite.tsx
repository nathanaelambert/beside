import { memo } from "react"
import { Image } from "react-native"
import type { RewardItem } from "@beside/rewards"

import { PixelArtSprite, snapScale } from "@/components/BesideMark"
import { flowerFamilyArt } from "@/components/iso-world/flowerFamilyArt"
import { treeFamilyAsset } from "@/components/iso-world/matureTreeAssets"
import { treeFamilyArt } from "@/components/iso-world/treeFamilyArt"
import type { TreeArtStage } from "@/components/iso-world/worldDetailArt"

export const RewardSprite = memo(function RewardSprite({
  item,
  scale = 3,
  growthStage,
}: {
  item: RewardItem
  scale?: number
  growthStage?: TreeArtStage
}) {
  const tree = growthStage && treeFamilyArt(item.id, growthStage)
  const flower = growthStage && flowerFamilyArt(item.id, growthStage)
  const asset = tree ? treeFamilyAsset(tree.id, tree.stage) : flower?.asset
  if (asset !== undefined) {
    const size = 32 * snapScale(scale)
    return (
      <Image
        testID={
          tree
            ? tree.stage === "mature"
              ? "reward-mature-tree"
              : "reward-growing-tree"
            : "reward-flower"
        }
        source={asset}
        resizeMode="contain"
        fadeDuration={0}
        style={{ width: size, height: size }}
      />
    )
  }
  return <PixelArtSprite art={item.artifact} scale={scale} />
})

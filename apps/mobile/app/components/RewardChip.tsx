import { TextStyle, View, ViewStyle } from "react-native"
import type { RewardItem } from "@beside/rewards"

import { world, worldShape } from "@/theme/world"

import { activityWorldStyles } from "./ActivityWorld"
import { PixelArtSprite } from "./BesideMark"
import { Text } from "./Text"

/** An item with its milestone or upgrade status. */
export function RewardChip({ item, detail }: { item: RewardItem; detail: string }) {
  return (
    <View style={$chip} testID="milestone-reward-chip">
      <View style={$chipArt}>
        <PixelArtSprite art={item.artifact} scale={1} />
      </View>
      <View style={$flex}>
        <Text text={item.name} weight="medium" style={$chipName} />
        <Text text={detail} style={activityWorldStyles.muted} />
      </View>
    </View>
  )
}

const $flex: ViewStyle = { flex: 1 }
const $chip: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 10 }
const $chipArt: ViewStyle = {
  width: 40,
  height: 40,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: world.meadow,
  borderRadius: worldShape.smallRadius,
}
const $chipName: TextStyle = { color: world.ink, fontSize: 13, lineHeight: 18 }

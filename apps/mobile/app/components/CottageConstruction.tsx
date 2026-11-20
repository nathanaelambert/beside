import { View, type ViewStyle } from "react-native"
import type { CottageLevel } from "@beside/api-client"

import { activityWorldStyles } from "./ActivityWorld"
import { PixelArtSprite } from "./BesideMark"
import { cottageTime, pocketWatchArt } from "./iso-world/cottageClockArt"
import { Text } from "./Text"

export function CottageCountdown({ level, seconds }: { level: CottageLevel; seconds: number }) {
  return (
    <View
      style={$countdown}
      testID="cottage-countdown"
      accessible
      accessibilityLabel={`Building level ${level}. ${seconds} seconds remaining.`}
    >
      <PixelArtSprite art={pocketWatchArt(seconds)} scale={1} />
      <Text
        text={`Building level ${level} · ${cottageTime(seconds)}`}
        style={activityWorldStyles.muted}
      />
    </View>
  )
}

const $countdown: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 6 }

import { memo, useMemo } from "react"
import { View, ViewStyle } from "react-native"
import type { RewardItem } from "@beside/rewards"

/** Native views at integer scales keep the shared pixel art crisp, without a native dependency. */
export const RewardSprite = memo(function RewardSprite({
  item,
  scale = 3,
}: {
  item: RewardItem
  scale?: number
}) {
  const { pixels, palette } = item.artifact
  const runs = useMemo(
    () =>
      pixels.flatMap((row, y) => {
        const result: ViewStyle[] = []
        for (let x = 0; x < row.length;) {
          const color = row[x]
          let end = x + 1
          while (end < row.length && row[end] === color) end++
          if (color !== ".")
            result.push({
              position: "absolute",
              left: x * scale,
              top: y * scale,
              width: (end - x) * scale,
              height: scale,
              backgroundColor: palette[color],
            })
          x = end
        }
        return result
      }),
    [pixels, palette, scale],
  )

  return (
    <View
      style={{ width: pixels[0].length * scale, height: pixels.length * scale }}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {runs.map((style, index) => (
        <View key={index} style={style} />
      ))}
    </View>
  )
})

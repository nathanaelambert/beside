import { Pressable, StyleSheet, View, type ViewStyle } from "react-native"

import { PixelArtSprite } from "@/components/BesideMark"
import { Text } from "@/components/Text"
import { acornArt, acornLabel } from "@/services/api/acorns"
import { world, worldShape } from "@/theme/world"

/** The home base's shared acorn pool, as a small pixel-world pill. */
export function AcornCount({
  amount,
  onPress,
  size = "small",
  testID,
  style,
}: {
  amount: number
  onPress?: () => void
  size?: "small" | "large"
  testID?: string
  style?: ViewStyle
}) {
  const large = size === "large"
  const content = (
    <>
      <PixelArtSprite art={acornArt} scale={large ? 3 : 2} />
      <Text
        text={String(amount)}
        weight="semiBold"
        style={large ? styles.largeText : styles.text}
        testID={testID ? `${testID}-value` : undefined}
      />
    </>
  )
  const label = `${acornLabel(amount)} in your home base${onPress ? ". Open the acorn shop." : ""}`
  return onPress ? (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        large && styles.large,
        pressed && styles.pressed,
        style,
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label}
      style={[styles.pill, large && styles.large, style]}
    >
      {content}
    </View>
  )
}

/** Inline "acorn + number" for prices and earnings inside text rows. */
export function AcornAmount({
  amount,
  signed,
  muted,
}: {
  amount: number
  signed?: boolean
  muted?: boolean
}) {
  return (
    <View style={styles.inline} accessible accessibilityLabel={acornLabel(amount)}>
      <PixelArtSprite art={acornArt} scale={2} />
      <Text
        text={signed && amount > 0 ? `+${amount}` : String(amount)}
        weight="semiBold"
        style={[styles.inlineText, muted && styles.muted]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  inline: { alignItems: "center", flexDirection: "row", gap: 4 },
  inlineText: { color: world.ink, fontSize: 14, lineHeight: 20 },
  large: { gap: 8, minHeight: worldShape.control, paddingHorizontal: 14 },
  largeText: { color: world.ink, fontSize: 22, lineHeight: 28 },
  muted: { color: world.muted },
  pill: {
    alignItems: "center",
    backgroundColor: world.panel,
    borderColor: world.meadowBorder,
    borderRadius: worldShape.radius,
    borderWidth: worldShape.border,
    flexDirection: "row",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 10,
  },
  pressed: { opacity: 0.75 },
  text: { color: world.ink, fontSize: 15, lineHeight: 20 },
})

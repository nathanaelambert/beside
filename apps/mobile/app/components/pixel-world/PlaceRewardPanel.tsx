import { useEffect } from "react"
import { StyleSheet, View } from "react-native"
import type { RewardItem } from "@beside/rewards"
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { WorldButton } from "@/components/ActivityWorld"
import { RewardSprite } from "@/components/RewardSprite"
import { Text } from "@/components/Text"
import { world } from "@/theme/world"

/** Same flow as planting the starter oak: preview on a marked spot, then confirm. */
export function PlaceRewardPanel({
  item,
  story,
  moving,
  hasPreview,
  saving,
  error,
  onCancel,
  onPlace,
  onSuggest,
}: {
  item: RewardItem
  story: string
  moving: boolean
  hasPreview: boolean
  saving: boolean
  error?: string
  onCancel: () => void
  onPlace: () => void
  onSuggest: () => void
}) {
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const reveal = useSharedValue(reduceMotion ? 1 : 0)
  useEffect(() => {
    reveal.value = reduceMotion ? 1 : withTiming(1, { duration: 210 })
  }, [reduceMotion, reveal])
  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 12 }],
  }))

  return (
    <Animated.View
      style={[styles.panel, { bottom: insets.bottom + 12 }, revealStyle]}
      testID="place-reward-panel"
    >
      <View style={styles.row}>
        <View style={styles.thumbnail}>
          <RewardSprite item={item} scale={1.5} />
        </View>
        <View style={styles.copy}>
          <Text
            text={`${moving ? "Move" : "Place"} the ${item.name}`}
            weight="semiBold"
            style={styles.title}
            accessibilityRole="header"
          />
          <Text text={story} style={styles.detail} numberOfLines={2} />
        </View>
      </View>
      <Text
        text={
          hasPreview
            ? "Preview · Tap another marked spot to try it there"
            : "Tap a marked spot on the lawn to preview it"
        }
        style={styles.detail}
        accessibilityLiveRegion="polite"
      />
      <Text text={error || " "} style={styles.error} accessibilityLiveRegion="polite" />
      <View style={styles.row}>
        <WorldButton text="Cancel" onPress={onCancel} disabled={saving} />
        <WorldButton
          text="Suggest spot"
          testID="suggest-reward-spot"
          onPress={onSuggest}
          disabled={saving}
          style={styles.copy}
        />
        <WorldButton
          text={saving ? "Placing…" : "Place here"}
          testID="confirm-reward-placement"
          preset="filled"
          onPress={onPlace}
          disabled={saving || !hasPreview}
          style={styles.copy}
        />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  copy: { flex: 1 },
  detail: { color: world.text, fontSize: 12, lineHeight: 16 },
  error: { color: world.error, fontSize: 12 },
  panel: {
    alignSelf: "center",
    backgroundColor: world.panel,
    borderColor: world.meadowBorder,
    borderRadius: 14,
    borderWidth: 1,
    boxShadow: "0 6px 20px rgba(52, 75, 61, 0.16)",
    gap: 8,
    maxWidth: 450,
    padding: 12,
    position: "absolute",
    width: "94%",
    zIndex: 1,
  },
  row: { alignItems: "center", flexDirection: "row", gap: 8 },
  thumbnail: {
    alignItems: "center",
    backgroundColor: world.meadow,
    borderColor: world.meadowBorder,
    borderRadius: 8,
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  title: { color: world.ink, fontSize: 18, lineHeight: 22 },
})

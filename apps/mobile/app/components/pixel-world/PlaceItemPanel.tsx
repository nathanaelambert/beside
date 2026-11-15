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

/** Buying or moving something in the meadow, in the same floating style as planting the oak. */
export function PlaceItemPanel({
  item,
  title,
  confirmText,
  hasPreview,
  saving,
  error,
  onCancel,
  onConfirm,
  onSuggest,
}: {
  item: RewardItem
  title: string
  confirmText: string
  hasPreview: boolean
  saving: boolean
  error?: string
  onCancel: () => void
  onConfirm: () => void
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
      testID="place-item-panel"
    >
      <View style={styles.row}>
        <View style={styles.thumb}>
          <RewardSprite item={item} scale={1} />
        </View>
        <View style={styles.copy}>
          <Text text={title} weight="semiBold" style={styles.title} accessibilityRole="header" />
          <Text
            testID="place-item-hint"
            text={
              hasPreview
                ? "Preview · Tap another marked spot to try it there"
                : "Tap a marked spot on the lawn"
            }
            style={styles.detail}
            accessibilityLiveRegion="polite"
          />
        </View>
      </View>
      <Text
        testID="place-item-error"
        text={error || " "}
        style={styles.error}
        accessibilityLiveRegion="polite"
      />
      <View style={styles.row}>
        <WorldButton
          text="Cancel"
          testID="place-item-cancel"
          onPress={onCancel}
          disabled={saving}
        />
        <WorldButton
          text="Suggest spot"
          testID="place-item-suggest"
          onPress={onSuggest}
          disabled={saving}
          style={styles.copy}
        />
        <WorldButton
          text={confirmText}
          testID="place-item-confirm"
          preset="filled"
          onPress={onConfirm}
          disabled={saving || !hasPreview}
          style={styles.confirm}
        />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  confirm: { flex: 1.4 },
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
  thumb: {
    alignItems: "center",
    backgroundColor: world.meadow,
    borderColor: world.meadowBorder,
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  title: { color: world.ink, fontSize: 18, lineHeight: 22 },
})

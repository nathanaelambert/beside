import { useEffect } from "react"
import { StyleSheet, View } from "react-native"
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

import { catalogue } from "./scene"

/** Place an earned garden object, or move a placed one. Same look as the oak panel. */
export function PlaceObjectPanel({
  itemId,
  moving,
  hasPreview,
  saving,
  error,
  onCancel,
  onConfirm,
  onSuggest,
}: {
  itemId: string
  moving: boolean
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
  const item = catalogue.get(itemId)
  const name = item?.name ?? "item"
  return (
    <Animated.View
      style={[styles.panel, { bottom: insets.bottom + 12 }, revealStyle]}
      testID="place-object-panel"
    >
      <View style={styles.row}>
        {item && (
          <View style={styles.thumb}>
            <RewardSprite item={item} scale={1.5} />
          </View>
        )}
        <View style={styles.copy}>
          <Text
            text={`${moving ? "Move" : "Place"} the ${name}`}
            weight="semiBold"
            style={styles.title}
            accessibilityRole="header"
          />
          <Text
            text={
              hasPreview
                ? "Preview · tap another marked spot to try it there"
                : "Tap a marked spot of open lawn"
            }
            style={styles.detail}
            accessibilityLiveRegion="polite"
          />
          <Text
            text={moving ? "Moving is free for any member." : "Earned together, placed by you."}
            style={styles.detail}
          />
        </View>
      </View>
      <Text text={error || " "} style={styles.error} accessibilityLiveRegion="polite" />
      <View style={styles.row}>
        <WorldButton
          text="Cancel"
          testID="place-object-cancel"
          onPress={onCancel}
          disabled={saving}
        />
        <WorldButton
          text="Suggest spot"
          testID="place-object-suggest"
          onPress={onSuggest}
          disabled={saving}
          style={styles.copy}
        />
        <WorldButton
          text={saving ? "Saving…" : moving ? "Move here" : "Place here"}
          testID="place-object-confirm"
          preset="filled"
          onPress={onConfirm}
          disabled={saving || !hasPreview}
          style={styles.copy}
        />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: 2 },
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
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  title: { color: world.ink, fontSize: 18, lineHeight: 22 },
})

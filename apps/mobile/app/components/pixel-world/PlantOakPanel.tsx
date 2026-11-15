import { useEffect, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { starterOakItemId } from "@beside/api-client/garden"
import { rewardItems } from "@beside/rewards"
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

const itemsPerPage = 4
const pageCount = Math.ceil(rewardItems.length / itemsPerPage)

export function PlantOakPanel({
  hasPreview,
  saving,
  error,
  onCancel,
  onPlant,
  onSuggest,
}: {
  hasPreview: boolean
  saving: boolean
  error?: string
  onCancel: () => void
  onPlant: () => void
  onSuggest: () => void
}) {
  const [page, setPage] = useState(0)
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
  const first = page * itemsPerPage
  const items = rewardItems.slice(first, first + itemsPerPage)

  return (
    <Animated.View
      style={[styles.panel, { bottom: insets.bottom + 12 }, revealStyle]}
      testID="plant-oak-panel"
    >
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text
            text="Decorations"
            weight="semiBold"
            style={styles.title}
            accessibilityRole="header"
          />
          <Text
            text={
              hasPreview
                ? "Preview · Tap another marked spot to move it"
                : "Tap a marked spot to preview the oak"
            }
            style={styles.detail}
            accessibilityLiveRegion="polite"
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next decorations"
          testID="browse-decorations"
          disabled={saving || pageCount < 2}
          onPress={() => setPage((current) => (current + 1) % pageCount)}
          style={({ pressed }) => [styles.browse, pressed && styles.pressed]}
        >
          <Text text="Next ›" weight="medium" style={styles.detail} />
        </Pressable>
      </View>
      <View style={styles.items} testID="garden-decoration-catalog">
        {items.map((item) => {
          const available = item.id === starterOakItemId
          return (
            <View
              key={item.id}
              style={[styles.item, available && styles.available]}
              testID={"decoration-" + item.id}
            >
              <RewardSprite item={item} scale={1} />
              <Text text={item.name} weight="medium" style={styles.itemName} />
              <Text text={available ? "Free" : "Preview"} style={styles.badge} />
            </View>
          )
        })}
      </View>
      <View style={styles.row}>
        <Text
          text="Only the oak can be planted in this demo."
          style={[styles.detail, styles.copy]}
        />
        <Text
          text={[first + 1, "–", first + items.length, " / ", rewardItems.length].join("")}
          style={styles.detail}
          accessibilityLiveRegion="polite"
        />
      </View>
      <Text text={error || " "} style={styles.error} accessibilityLiveRegion="polite" />
      <View style={styles.row}>
        <WorldButton text="Cancel" onPress={onCancel} disabled={saving} />
        <WorldButton
          text="Suggest spot"
          testID="suggest-oak-spot"
          onPress={onSuggest}
          disabled={saving}
          style={styles.copy}
        />
        <WorldButton
          text={saving ? "Planting…" : "Plant oak"}
          testID="confirm-starter-oak"
          preset="filled"
          onPress={onPlant}
          disabled={saving || !hasPreview}
          style={styles.copy}
        />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  available: { backgroundColor: world.meadow, borderColor: world.leaf },
  badge: { color: world.text, fontSize: 10, textAlign: "center" },
  browse: {
    alignItems: "center",
    backgroundColor: world.meadow,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 62,
    paddingHorizontal: 8,
  },
  copy: { flex: 1 },
  detail: { color: world.text, fontSize: 12, lineHeight: 16 },
  error: { color: world.error, fontSize: 12 },
  item: {
    alignItems: "center",
    backgroundColor: world.paper,
    borderColor: world.line,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  itemName: { color: world.ink, flex: 1, fontSize: 11, lineHeight: 14, textAlign: "center" },
  items: { flexDirection: "row", gap: 6 },
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
  pressed: { opacity: 0.75 },
  row: { alignItems: "center", flexDirection: "row", gap: 8 },
  title: { color: world.ink, fontSize: 18, lineHeight: 22 },
})

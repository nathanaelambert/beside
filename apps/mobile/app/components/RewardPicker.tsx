import { Pressable, TextStyle, View, ViewStyle } from "react-native"
import type { RewardItem } from "@beside/rewards"
import { guideFor } from "@beside/rewards/guidance"

import { world, worldEyebrow, worldShape } from "@/theme/world"
import { namesLabel, rewardMirror, suggestion, type Cadence } from "@/utils/rewardChoice"

import { activityWorldStyles } from "./ActivityWorld"
import { PixelArtSprite } from "./BesideMark"
import { Text } from "./Text"

/** Categories in catalog order, with the suggested ones for this cadence first. */
function sections(items: RewardItem[], cadence: Cadence) {
  const { roles } = suggestion(cadence)
  const groups = new Map<string, RewardItem[]>()
  for (const item of items) groups.set(item.category, [...(groups.get(item.category) ?? []), item])
  const rank = (category: string) => {
    const index = roles.indexOf(guideFor(category).role)
    return index === -1 ? roles.length : index
  }
  return [...groups]
    .map(([category, members], order) => ({
      category,
      members,
      order,
      suggested: rank(category) < roles.length,
    }))
    .sort((a, b) => rank(a.category) - rank(b.category) || a.order - b.order)
}

export function RewardTile({
  item,
  selected,
  count,
  onPress,
}: {
  item: RewardItem
  selected: boolean
  count: number
  onPress: () => void
}) {
  return (
    <Pressable
      testID={`reward-option-${item.id}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${item.name}. ${count ? `${count} already in your meadow.` : ""}`}
      onPress={onPress}
      style={({ pressed }) => [$tile, selected && $tileSelected, pressed && $pressed]}
    >
      <View style={$tileArt}>
        <PixelArtSprite art={item.artifact} scale={2} />
      </View>
      <Text text={item.name} numberOfLines={2} style={$tileName} />
      <Text text={count ? `${count} in meadow` : " "} style={$tileCount} />
      {selected && (
        <View style={$check} pointerEvents="none">
          <Text text="✓" style={$checkText} />
        </View>
      )}
    </Pressable>
  )
}

/**
 * Equal-value reward picker. Nothing here has a price: suggestions come from the
 * milestone's shape (one-off or repeating), and a "mirror" says what a choice will
 * look like in the meadow. The group, not a currency, is the check on a choice.
 */
export function RewardPicker({
  items,
  value,
  onChange,
  cadence,
  counts,
  rosterNames,
  proposerNote,
}: {
  items: RewardItem[]
  value: string | null
  onChange: (itemId: string | null) => void
  cadence: Cadence
  counts: Map<string, number>
  rosterNames: string[]
  proposerNote?: string
}) {
  const picked = items.find((item) => item.id === value)
  const hint = suggestion(cadence)
  const mirror = picked && rewardMirror(picked, cadence)
  return (
    <View style={$root} testID="reward-picker">
      <View style={$principle}>
        <Text text="EQUAL VALUE" style={worldEyebrow} />
        <Text
          text="Every reward is worth the same: one milestone earns one. What makes it special is picking the one that fits."
          style={activityWorldStyles.body}
        />
      </View>
      <View style={$hintRow}>
        <View style={$dot} />
        <Text
          text={hint.text}
          style={[activityWorldStyles.muted, $flex]}
          testID="reward-suggestion"
        />
      </View>
      <View accessibilityRole="radiogroup" style={$sections}>
        {sections(items, cadence).map(({ category, members, suggested }) => (
          <View key={category} style={$section} testID={`reward-category-${category}`}>
            <View style={$sectionHeading}>
              <Text text={category} weight="semiBold" style={$sectionTitle} />
              {suggested && <Text text="Suggested" style={$badge} />}
            </View>
            <Text text={guideFor(category).fit} style={activityWorldStyles.muted} />
            <View style={$tiles}>
              {members.map((item) => (
                <RewardTile
                  key={item.id}
                  item={item}
                  selected={item.id === value}
                  count={counts.get(item.id) ?? 0}
                  onPress={() => onChange(item.id)}
                />
              ))}
            </View>
          </View>
        ))}
        <Pressable
          testID="reward-option-none"
          accessibilityRole="radio"
          accessibilityState={{ selected: !value }}
          onPress={() => onChange(null)}
          style={({ pressed }) => [$none, !value && $noneSelected, pressed && $pressed]}
        >
          <Text
            text={value ? "No reward for this milestone" : "✓ No reward for this milestone"}
            style={activityWorldStyles.body}
          />
        </Pressable>
      </View>
      {picked ? (
        <View style={$summary} testID="reward-summary" accessibilityLiveRegion="polite">
          <View style={$summaryHeading}>
            <View style={$summaryArt}>
              <PixelArtSprite art={picked.artifact} scale={3} />
            </View>
            <View style={$flex}>
              <Text text="YOUR PICK" style={worldEyebrow} />
              <Text
                text={picked.name}
                weight="semiBold"
                style={activityWorldStyles.sectionTitle}
                testID="reward-summary-name"
              />
              <Text text={guideFor(picked.category).fit} style={activityWorldStyles.muted} />
            </View>
          </View>
          {!!mirror && (
            <View style={$mirror} testID="reward-mirror">
              <Text text="WORTH A THOUGHT" style={worldEyebrow} />
              <Text text={mirror} style={activityWorldStyles.body} />
            </View>
          )}
          {!!rosterNames.length && (
            <Text
              text={
                cadence.recurring
                  ? `One lands in your meadow each session that ${namesLabel(rosterNames)} all check in.`
                  : `Lands in your meadow when ${namesLabel(rosterNames)} all check in.`
              }
              style={activityWorldStyles.body}
            />
          )}
          {!!proposerNote && <Text text={proposerNote} style={activityWorldStyles.muted} />}
        </View>
      ) : (
        <Text
          text="No reward: this milestone still counts, it just won’t add anything to the meadow."
          style={activityWorldStyles.muted}
        />
      )}
    </View>
  )
}

const $root: ViewStyle = { gap: 16 }
const $flex: ViewStyle & TextStyle = { flex: 1 }
const $principle: ViewStyle = {
  backgroundColor: world.meadow,
  borderColor: world.meadowBorder,
  borderWidth: worldShape.border,
  borderRadius: worldShape.radius,
  padding: 14,
  gap: 4,
}
const $hintRow: ViewStyle = { flexDirection: "row", gap: 10, alignItems: "flex-start" }
const $dot: ViewStyle = { width: 6, height: 6, backgroundColor: world.leaf, marginTop: 7 }
const $sections: ViewStyle = { gap: 18 }
const $section: ViewStyle = { gap: 6 }
const $sectionHeading: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 8 }
const $sectionTitle: TextStyle = { color: world.ink, fontSize: 15, lineHeight: 21 }
const $badge: TextStyle = {
  color: world.onForest,
  backgroundColor: world.leaf,
  borderRadius: worldShape.smallRadius,
  overflow: "hidden",
  fontSize: 10,
  lineHeight: 16,
  letterSpacing: 0.6,
  paddingHorizontal: 6,
}
const $tiles: ViewStyle = { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }
const $tile: ViewStyle = {
  width: 78,
  alignItems: "center",
  backgroundColor: world.panel,
  borderColor: world.line,
  borderWidth: worldShape.border,
  borderRadius: worldShape.radius,
  paddingTop: 6,
  paddingBottom: 4,
  paddingHorizontal: 4,
  gap: 2,
}
const $tileSelected: ViewStyle = {
  backgroundColor: world.meadow,
  borderColor: world.forest,
  borderWidth: 2,
  paddingTop: 5,
  paddingBottom: 3,
  paddingHorizontal: 3,
}
const $tileArt: ViewStyle = { width: 64, height: 64 }
const $tileName: TextStyle = { color: world.ink, fontSize: 11, lineHeight: 14, textAlign: "center" }
const $tileCount: TextStyle = { color: world.muted, fontSize: 9, lineHeight: 12 }
const $check: ViewStyle = {
  position: "absolute",
  top: 3,
  right: 3,
  width: 18,
  height: 18,
  borderRadius: 4,
  backgroundColor: world.forest,
  alignItems: "center",
  justifyContent: "center",
}
const $checkText: TextStyle = { color: world.onForest, fontSize: 11, lineHeight: 14 }
const $pressed: ViewStyle = { opacity: 0.75 }
const $none: ViewStyle = {
  minHeight: worldShape.control,
  justifyContent: "center",
  paddingHorizontal: 14,
  borderRadius: worldShape.radius,
  borderWidth: worldShape.border,
  borderColor: world.line,
  borderStyle: "dashed",
}
const $noneSelected: ViewStyle = { borderStyle: "solid", borderColor: world.forest }
const $summary: ViewStyle = {
  backgroundColor: world.panel,
  borderColor: world.line,
  borderWidth: worldShape.border,
  borderRadius: worldShape.radius,
  padding: 14,
  gap: 12,
}
const $summaryHeading: ViewStyle = { flexDirection: "row", gap: 14, alignItems: "center" }
const $summaryArt: ViewStyle = {
  width: 108,
  height: 108,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: world.meadow,
  borderColor: world.meadowBorder,
  borderWidth: worldShape.border,
  borderRadius: worldShape.radius,
}
const $mirror: ViewStyle = {
  borderLeftWidth: 3,
  borderLeftColor: world.leaf,
  paddingLeft: 10,
  gap: 2,
}

import { useEffect } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"
import type { RewardItem } from "@beside/rewards"
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import { avatarThumbnail, type Avatar } from "@/components/pixel-world/avatars"
import { footprint } from "@/components/pixel-world/scene"
import { world, worldEyebrow, worldShape } from "@/theme/world"
import { firstName, namesLabel, type RewardStatus } from "@/utils/rewardChoice"

import { activityWorldStyles, WorldButton } from "./ActivityWorld"
import { PixelArtSprite } from "./BesideMark"
import { Text } from "./Text"

const eyebrow: Record<RewardStatus, string> = {
  proposed: "REWARD · PROPOSED",
  locked: "REWARD · LOCKED IN",
  earned: "REWARD · EARNED",
  placed: "REWARD · IN THE MEADOW",
  missed: "REWARD · NOT EARNED",
}

export function rewardStatusLine({
  status,
  rosterNames,
  agreedNames,
  checkedInCount,
}: {
  status: RewardStatus
  rosterNames: string[]
  agreedNames: string[]
  checkedInCount: number
}) {
  switch (status) {
    case "proposed": {
      const waiting = rosterNames.filter((name) => !agreedNames.includes(name))
      if (!waiting.length)
        return rosterNames.length > 1
          ? "Everyone agreed. It locks in at the first check-in."
          : "It locks in at your first check-in."
      return agreedNames.length
        ? `${namesLabel(agreedNames)} agreed. Waiting on ${namesLabel(waiting)}.`
        : `Waiting on ${namesLabel(waiting)} to agree.`
    }
    case "locked":
      return `${checkedInCount} of ${rosterNames.length} checked in. It lands when everyone has.`
    case "earned":
      return "Everyone made it. Find it a spot in the meadow."
    case "placed":
      return "Standing in your meadow."
    case "missed":
      return "The window closed before everyone checked in, so it didn’t land this time."
  }
}

/** The reward attached to a milestone, its roster, and the one next step that fits. */
export function MilestoneReward({
  item,
  status,
  roster,
  agreed,
  checkedIn,
  currentUserId,
  busy,
  error,
  onAgree,
  onChange,
  onPlace,
  onView,
}: {
  item: RewardItem
  status: RewardStatus
  roster: Avatar[]
  agreed: string[]
  checkedIn: Set<string>
  currentUserId?: string
  busy?: boolean
  error?: string
  onAgree?: () => void
  onChange?: () => void
  onPlace?: () => void
  onView?: () => void
}) {
  const names = roster.map((member) => firstName(member.name))
  const agreedNames = roster
    .filter((member) => agreed.includes(member.key))
    .map((member) => firstName(member.name))
  const canAgree =
    status === "proposed" &&
    !!currentUserId &&
    roster.some((member) => member.key === currentUserId) &&
    !agreed.includes(currentUserId)
  return (
    <View style={[$card, status === "earned" && $earned]} testID="milestone-reward">
      <View style={$heading}>
        <View style={[$art, status === "missed" && $missedArt]}>
          <PixelArtSprite art={item.artifact} scale={2} />
        </View>
        <View style={$flex}>
          <Text text={eyebrow[status]} style={worldEyebrow} testID="milestone-reward-status" />
          <Text
            text={item.name}
            weight="semiBold"
            style={activityWorldStyles.sectionTitle}
            testID="milestone-reward-name"
          />
          <Text
            text={rewardStatusLine({
              status,
              rosterNames: names,
              agreedNames,
              checkedInCount: roster.filter((member) => checkedIn.has(member.key)).length,
            })}
            style={activityWorldStyles.muted}
            accessibilityLiveRegion="polite"
          />
        </View>
      </View>
      {status !== "placed" && roster.length > 1 && (
        <View style={$roster} accessibilityRole="list">
          {roster.map((member) => {
            const done =
              status === "proposed" ? agreed.includes(member.key) : checkedIn.has(member.key)
            return (
              <View
                key={member.key}
                style={$member}
                accessibilityLabel={`${member.name}: ${
                  status === "proposed"
                    ? done
                      ? "agreed"
                      : "hasn’t agreed yet"
                    : done
                      ? "checked in"
                      : "not checked in yet"
                }`}
              >
                <View style={!done && $faded}>
                  <PixelArtSprite art={avatarThumbnail(member.frames.idle)} scale={2} />
                </View>
                <Text
                  text={
                    done ? (status === "proposed" ? "✓ agreed" : "✓ in") : firstName(member.name)
                  }
                  style={[$memberLabel, done && $done]}
                  numberOfLines={1}
                />
              </View>
            )
          })}
        </View>
      )}
      {!!error && <Text text={error} accessibilityRole="alert" style={activityWorldStyles.error} />}
      {status === "proposed" && (canAgree || onChange) && (
        <View style={$actions}>
          {canAgree && onAgree && (
            <WorldButton
              text={busy ? "Saving…" : "Agree"}
              testID="reward-agree"
              preset="filled"
              disabled={busy}
              onPress={onAgree}
              style={$flex}
            />
          )}
          {onChange && (
            <WorldButton
              text="Suggest another"
              testID="reward-change"
              disabled={busy}
              onPress={onChange}
              style={$flex}
            />
          )}
        </View>
      )}
      {status === "earned" && onPlace && (
        <WorldButton
          text="Place it in the meadow"
          testID="reward-place"
          preset="filled"
          onPress={onPlace}
        />
      )}
      {status === "placed" && onView && (
        <WorldButton text="See it in the meadow" testID="reward-view" onPress={onView} />
      )}
    </View>
  )
}

/** A compact reward line for upcoming milestones. */
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

const sparkles = [
  { x: -46, y: -30, delay: 260 },
  { x: 40, y: -40, delay: 340 },
  { x: 52, y: 6, delay: 420 },
  { x: -54, y: 12, delay: 380 },
]

function Sparkle({ x, y, delay }: { x: number; y: number; delay: number }) {
  const reduceMotion = useReducedMotion()
  const opacity = useSharedValue(reduceMotion ? 0 : 0)
  useEffect(() => {
    if (reduceMotion) return
    opacity.value = withDelay(
      delay,
      withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 700 })),
    )
  }, [delay, opacity, reduceMotion])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return (
    <Animated.View
      pointerEvents="none"
      style={[$sparkle, { transform: [{ translateX: x }, { translateY: y }] }, style]}
    />
  )
}

/** A ground shadow under the sprite's actual base, like the meadow draws it. */
function shadowFor(item: RewardItem): ViewStyle {
  const { left, right, bottom } = footprint(item.artifact)
  const width = (right - left + 1) * 4 + 12
  return {
    width,
    left: ((left + right + 1) / 2) * 4 - width / 2,
    top: (bottom + 1) * 4 - 6,
  }
}

/** Shown once, right after the last check-in completes a reward. */
export function RewardLanded({
  item,
  milestoneName,
  onPlace,
  onDismiss,
}: {
  item: RewardItem
  milestoneName: string
  onPlace: () => void
  onDismiss: () => void
}) {
  const reduceMotion = useReducedMotion()
  const drop = useSharedValue(reduceMotion ? 0 : -60)
  const fade = useSharedValue(reduceMotion ? 1 : 0)
  useEffect(() => {
    if (reduceMotion) return
    fade.value = withTiming(1, { duration: 180 })
    drop.value = withSpring(0, { damping: 9, stiffness: 160, mass: 0.8 })
  }, [drop, fade, reduceMotion])
  const spriteStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drop.value }] }))
  const cardStyle = useAnimatedStyle(() => ({ opacity: fade.value }))
  return (
    <Animated.View style={[$landed, cardStyle]} testID="reward-landed" accessibilityRole="alert">
      <View style={$landedStage}>
        {sparkles.map((sparkle) => (
          <Sparkle key={`${sparkle.x}${sparkle.y}`} {...sparkle} />
        ))}
        <View style={$landedSprite}>
          <View style={[$landedShadow, shadowFor(item)]} />
          <Animated.View style={spriteStyle}>
            <PixelArtSprite art={item.artifact} scale={4} />
          </Animated.View>
        </View>
      </View>
      <Text text="EVERYONE MADE IT" style={[worldEyebrow, $center]} />
      <Text
        text={`The ${item.name} is yours`}
        weight="semiBold"
        style={[activityWorldStyles.title, $center]}
      />
      <Text
        text={`Earned together for “${milestoneName}”. It’s waiting by the path until someone finds it a spot.`}
        style={[activityWorldStyles.body, $center]}
      />
      <WorldButton
        text="Place it in the meadow"
        testID="reward-landed-place"
        preset="filled"
        onPress={onPlace}
      />
      <Pressable accessibilityRole="button" onPress={onDismiss} style={$later}>
        <Text text="Later" style={activityWorldStyles.body} />
      </Pressable>
    </Animated.View>
  )
}

const $flex: ViewStyle = { flex: 1 }
const $center: TextStyle = { textAlign: "center" }
const $card: ViewStyle = {
  backgroundColor: world.meadow,
  borderColor: world.meadowBorder,
  borderWidth: worldShape.border,
  borderRadius: worldShape.radius,
  padding: 12,
  gap: 12,
}
const $earned: ViewStyle = { borderColor: world.leaf, borderWidth: 2, padding: 11 }
const $heading: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 12 }
const $art: ViewStyle = {
  width: 72,
  height: 72,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: world.paper,
  borderColor: world.meadowBorder,
  borderWidth: worldShape.border,
  borderRadius: worldShape.radius,
}
const $missedArt: ViewStyle = { opacity: 0.45 }
const $roster: ViewStyle = { flexDirection: "row", flexWrap: "wrap", gap: 10 }
const $member: ViewStyle = { width: 56, alignItems: "center", gap: 2 }
const $faded: ViewStyle = { opacity: 0.4 }
const $memberLabel: TextStyle = { color: world.muted, fontSize: 11, lineHeight: 15 }
const $done: TextStyle = { color: world.forest }
const $actions: ViewStyle = { flexDirection: "row", gap: 10 }
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
const $landed: ViewStyle = {
  backgroundColor: world.panel,
  borderColor: world.leaf,
  borderWidth: 2,
  borderRadius: worldShape.radius,
  padding: 18,
  gap: 10,
}
const $landedStage: ViewStyle = {
  height: 150,
  alignItems: "center",
  justifyContent: "flex-end",
  backgroundColor: world.meadow,
  borderRadius: worldShape.radius,
  paddingBottom: 6,
}
const $landedSprite: ViewStyle = { width: 128, height: 128 }
const $landedShadow: ViewStyle = {
  position: "absolute",
  height: 8,
  borderRadius: 4,
  backgroundColor: "rgba(30, 52, 34, 0.18)",
}
const $sparkle: ViewStyle = {
  position: "absolute",
  top: 70,
  width: 6,
  height: 6,
  backgroundColor: "#fff4cf",
  borderColor: world.forest,
  borderWidth: 1,
}
const $later: ViewStyle = { alignSelf: "center", minHeight: 40, justifyContent: "center" }

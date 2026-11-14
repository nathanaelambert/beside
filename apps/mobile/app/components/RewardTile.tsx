import { Pressable, TextStyle, View, ViewStyle } from "react-native"
import type { PixelArt } from "@beside/rewards"

import { PixelArtSprite } from "@/components/BesideMark"
import { catalogue } from "@/components/pixel-world/scene"
import { world, worldShape } from "@/theme/world"

import { statusLine, type CatalogEntry, type StatusTone } from "./pixel-world/garden"
import { Text } from "./Text"

// A small padlock in the world's outline and parchment colors.
export const padlock: PixelArt = {
  format: "pixel-art",
  palette: { o: "#3b2a2e", g: "#e2b553", d: "#a9792f", h: "#f6dc8f", k: "#3b2a2e" },
  pixels: [
    "..oooo..",
    ".o....o.",
    ".o....o.",
    "oooooooo",
    "ohggggdo",
    "ohggkgdo",
    "oggkkgdo",
    "oggggddo",
    "oooooooo",
  ],
}

const toneColor: Record<StatusTone, string> = {
  open: world.leaf,
  ready: world.forest,
  queued: "#9a7a3a",
  locked: world.muted,
}

/** One catalog item with what it needs in this home base right now. */
export function RewardTile({
  entry,
  selected,
  onPress,
  testID,
  compact,
}: {
  entry: CatalogEntry
  selected?: boolean
  onPress?: () => void
  testID?: string
  compact?: boolean
}) {
  const item = catalogue.get(entry.itemId)
  const { tone, text } = statusLine(entry.status)
  const locked = tone === "locked"
  const counts = [
    entry.inGarden && `${entry.inGarden} in garden`,
    entry.planned && `${entry.planned} planned`,
    entry.waiting && `${entry.waiting} waiting`,
  ].filter(Boolean)
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={{ selected: !!selected, disabled: !onPress }}
      accessibilityLabel={`${entry.name}. ${text}.${counts.length ? ` ${counts.join(", ")}.` : ""}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        $tile,
        compact && $compact,
        selected && $selected,
        locked && $locked,
        pressed && $pressed,
      ]}
    >
      <View style={$art}>
        {item && (
          <PixelArtSprite
            art={item.artifact}
            scale={compact ? 1.5 : 2}
            style={locked ? $dim : undefined}
          />
        )}
        {locked && <PixelArtSprite art={padlock} scale={2} style={$lock} />}
      </View>
      <View style={$copy}>
        <Text text={entry.name} weight="semiBold" style={$name} numberOfLines={1} />
        <Text text={text} style={[$status, { color: toneColor[tone] }]} />
        {!compact && !!counts.length && <Text text={counts.join(" · ")} style={$counts} />}
      </View>
    </Pressable>
  )
}

const $tile: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  padding: 10,
  backgroundColor: world.panel,
  borderColor: world.line,
  borderWidth: worldShape.border,
  borderRadius: worldShape.radius,
  minHeight: 76,
}
const $compact: ViewStyle = { minHeight: 64, padding: 8 }
const $selected: ViewStyle = {
  borderColor: world.forest,
  borderWidth: 2,
  backgroundColor: world.meadow,
}
const $locked: ViewStyle = { backgroundColor: world.paper }
const $pressed: ViewStyle = { opacity: 0.8 }
const $art: ViewStyle = {
  width: 64,
  height: 64,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: world.meadow,
  borderRadius: worldShape.smallRadius,
}
const $dim: ViewStyle = { opacity: 0.35 }
const $lock: ViewStyle = { position: "absolute", right: 4, bottom: 4 }
const $copy: ViewStyle = { flex: 1, gap: 2 }
const $name: TextStyle = { color: world.ink, fontSize: 15, lineHeight: 21 }
const $status: TextStyle = { fontSize: 12, lineHeight: 17 }
const $counts: TextStyle = { color: world.muted, fontSize: 11, lineHeight: 16 }

import { useState } from "react"
import { TextStyle, View, ViewStyle } from "react-native"
import type { HomebaseRewards } from "@beside/api-client"

import { world, worldEyebrow } from "@/theme/world"

import { activityWorldStyles, WorldButton as Button } from "./ActivityWorld"
import { PixelArtSprite } from "./BesideMark"
import { candidateLabel, candidatesOf, plannable } from "./pixel-world/garden"
import { catalogue } from "./pixel-world/scene"
import { RewardTile } from "./RewardTile"
import { Text } from "./Text"

/**
 * Choose what the home base earns when everyone completes the milestone. Locked rewards stay
 * visible, with what they need, but cannot be chosen.
 */
export function RewardPicker({
  rewards,
  value,
  onChange,
  buildOnId,
  onBuildOnChange,
}: {
  rewards: HomebaseRewards | undefined
  value: string | null
  onChange: (itemId: string | null) => void
  /** For an upgrade: the chosen precursor (garden object or planned reward). */
  buildOnId: string | null
  onBuildOnChange: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = rewards?.items.find((item) => item.itemId === value)
  const candidates = candidatesOf(selected?.status)
  const precursorId =
    selected && selected.status.kind !== "place" ? selected.status.precursorId : undefined
  const chosen = candidates.find((c) => c.id === buildOnId) ?? candidates[0]
  if (!rewards) return null
  return (
    <View style={$group} testID="reward-picker">
      <Text text="REWARD FOR THE GARDEN" style={worldEyebrow} />
      {selected ? (
        <RewardTile entry={selected} selected testID="reward-picker-selected" />
      ) : (
        <Text
          text="No reward. Everyone’s check-in still counts toward your progress."
          style={activityWorldStyles.muted}
        />
      )}
      {precursorId && candidates.length > 0 && (
        <View style={$group} testID="reward-build-on">
          <Text text="BUILDS ON" style={worldEyebrow} />
          {candidates.map((candidate) => {
            const art = catalogue.get(precursorId)?.artifact
            const active = candidate.id === chosen?.id
            return (
              <Button
                key={candidate.id}
                testID={`reward-build-on-${candidate.id}`}
                preset={active ? "filled" : "default"}
                accessibilityState={{ selected: active }}
                onPress={() => onBuildOnChange(candidate.id)}
                LeftAccessory={() =>
                  art ? <PixelArtSprite art={art} scale={1} style={$candidateArt} /> : null
                }
                text={candidateLabel(candidate, precursorId)}
              />
            )
          })}
          <Text
            text="Upgrades are one-off rewards, so this milestone does not repeat."
            style={$hint}
          />
        </View>
      )}
      <Button
        testID="reward-picker-toggle"
        text={open ? "Done" : selected ? "Change reward" : "Choose a reward"}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <View style={$group}>
          <Button
            text="No reward"
            testID="reward-option-none"
            preset={value === null ? "filled" : "default"}
            onPress={() => {
              onChange(null)
              setOpen(false)
            }}
          />
          {rewards.items.map((entry) => (
            <RewardTile
              key={entry.itemId}
              entry={entry}
              compact
              selected={entry.itemId === value}
              testID={`reward-option-${entry.itemId}`}
              onPress={
                plannable(entry)
                  ? () => {
                      onChange(entry.itemId)
                      onBuildOnChange(null)
                      setOpen(false)
                    }
                  : undefined
              }
            />
          ))}
        </View>
      )}
    </View>
  )
}

const $group: ViewStyle = { gap: 10 }
const $hint: TextStyle = { color: world.text, fontSize: 12, lineHeight: 18 }
const $candidateArt: ViewStyle = { marginRight: 8 }

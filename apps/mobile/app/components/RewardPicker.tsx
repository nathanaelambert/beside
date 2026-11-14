import { useState } from "react"
import { TextStyle, View, ViewStyle } from "react-native"
import type { HomebaseRewards } from "@beside/api-client"

import { world, worldEyebrow } from "@/theme/world"

import { activityWorldStyles, WorldButton as Button } from "./ActivityWorld"
import { plannable, statusLine } from "./pixel-world/garden"
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
}: {
  rewards: HomebaseRewards | undefined
  value: string | null
  onChange: (itemId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = rewards?.items.find((item) => item.itemId === value)
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
      {selected && selected.status.kind !== "place" && (
        <Text
          text={`${statusLine(selected.status).text}. Upgrades are one-off rewards, so this milestone does not repeat.`}
          style={$hint}
        />
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

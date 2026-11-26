import { useEffect, useState } from "react"
import { Modal, Pressable, ScrollView, TextStyle, View, ViewStyle } from "react-native"
import type { RewardItem } from "@beside/rewards"
import { SafeAreaView } from "react-native-safe-area-context"

import { world, worldEyebrow, worldShape } from "@/theme/world"
import { namesLabel, type Cadence } from "@/utils/rewardChoice"

import { activityWorldStyles, WorldButton, WorldTextField } from "./ActivityWorld"
import { FormChoice } from "./MilestoneScheduleFields"
import { RewardChip } from "./RewardChip"
import { RewardPicker } from "./RewardPicker"
import { Text } from "./Text"

export type MilestoneRewardChoice = { itemId: string | null; upgradeRewardId: string | null }
export type MilestoneDraft = MilestoneRewardChoice & { name: string; quantity: number }

type Props = {
  visible: boolean
  milestoneName?: string
  items: RewardItem[]
  initial: string | null
  initialUpgradeId: string | null
  upgrades: { id: string; item: RewardItem; detail: string }[]
  upgradeRosterNames: string[]
  initialUpgradeRosterNames: string[]
  cadence: Cadence
  counts: Map<string, number>
  rosterNames: string[]
  saving: boolean
  error?: string
  onCancel: () => void
} & (
  | { plan: true; onSave: (draft: MilestoneDraft) => void }
  | { plan?: false; onSave: (choice: MilestoneRewardChoice) => void }
)

/** Choose a reward when planning a milestone or editing a milestone before its first check-in. */
export function RewardChangeSheet(props: Props) {
  const {
    visible,
    milestoneName,
    items,
    initial,
    initialUpgradeId,
    upgrades,
    upgradeRosterNames,
    initialUpgradeRosterNames,
    cadence,
    counts,
    rosterNames,
    saving,
    error,
    onCancel,
  } = props
  const [name, setName] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [value, setValue] = useState(initial)
  const [upgradeId, setUpgradeId] = useState(initialUpgradeId)
  const [mode, setMode] = useState<"item" | "upgrade">(initialUpgradeId ? "upgrade" : "item")
  useEffect(() => {
    if (!visible) return
    setValue(initial)
    setUpgradeId(initialUpgradeId)
    setMode(initialUpgradeId ? "upgrade" : "item")
  }, [visible, initial, initialUpgradeId])
  const itemId = mode === "item" ? value : null
  const upgradeRewardId = mode === "upgrade" ? upgradeId : null
  const unchanged = itemId === initial && upgradeRewardId === initialUpgradeId
  const upgradeRoster =
    upgradeId && upgradeId === initialUpgradeId ? initialUpgradeRosterNames : upgradeRosterNames
  const amount = Number(quantity)
  const invalidDraft = props.plan && (!name.trim() || !Number.isFinite(amount) || amount <= 0)

  function save() {
    const choice = { itemId, upgradeRewardId }
    if (props.plan) props.onSave({ ...choice, name: name.trim(), quantity: amount })
    else if (unchanged) onCancel()
    else props.onSave(choice)
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={$root} edges={["top", "bottom"]} testID="reward-change-sheet">
        <View style={$bar}>
          <Pressable accessibilityRole="button" onPress={onCancel} style={$barButton}>
            <Text text="Cancel" style={activityWorldStyles.body} />
          </Pressable>
          <Text
            text={props.plan ? "Plan milestone" : "Suggest a reward"}
            weight="semiBold"
            style={$barTitle}
          />
          <View style={$barButton} />
        </View>
        <ScrollView contentContainerStyle={$content} keyboardShouldPersistTaps="handled">
          {props.plan ? (
            <>
              <WorldTextField
                label="Milestone name"
                testID="plan-milestone-name"
                value={name}
                onChangeText={setName}
                maxLength={200}
                editable={!saving}
              />
              <WorldTextField
                label="Quantity"
                testID="plan-milestone-quantity"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                editable={!saving}
              />
              <Text
                text="Members can check in any time after you save."
                style={activityWorldStyles.muted}
              />
            </>
          ) : (
            <Text text={milestoneName?.toUpperCase()} style={worldEyebrow} />
          )}
          {!!upgrades.length && (
            <FormChoice
              label="Milestone reward"
              value={mode}
              options={[
                { value: "item", label: "Choose a new item" },
                { value: "upgrade", label: "Upgrade an earned reward" },
              ]}
              onChange={setMode}
              testID="reward-choice-mode"
            />
          )}
          {mode === "item" ? (
            <RewardPicker
              items={items}
              value={value}
              onChange={setValue}
              cadence={cadence}
              counts={counts}
              rosterNames={rosterNames}
              proposerNote={
                rosterNames.length > 1
                  ? "Everyone can agree or suggest another item before the first check-in."
                  : undefined
              }
            />
          ) : (
            <>
              <Text
                text={
                  upgradeRoster.length
                    ? `${namesLabel(upgradeRoster)} must all check in to add one level.`
                    : "Everyone on the milestone roster must check in to add one level."
                }
                style={activityWorldStyles.body}
              />
              {upgrades.map(({ id, item, detail }) => (
                <Pressable
                  key={id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: id === upgradeId }}
                  accessibilityLabel={`${item.name}, ${detail}`}
                  onPress={() => setUpgradeId(id)}
                  style={[$choice, id === upgradeId && $selected]}
                  testID={`reward-upgrade-option-${id}`}
                >
                  <RewardChip item={item} detail={detail} />
                </Pressable>
              ))}
            </>
          )}
          {!!error && (
            <Text text={error} accessibilityRole="alert" style={activityWorldStyles.error} />
          )}
        </ScrollView>
        <View style={$footer}>
          <WorldButton
            text={
              saving
                ? "Saving…"
                : props.plan
                  ? "Save milestone"
                  : unchanged
                    ? "Keep this reward"
                    : "Save reward choice"
            }
            testID={props.plan ? "plan-milestone-save" : "reward-change-save"}
            preset="filled"
            disabled={saving || invalidDraft || (mode === "upgrade" && !upgradeRewardId)}
            onPress={save}
          />
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const $root: ViewStyle = { flex: 1, backgroundColor: world.paper }
const $bar: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 12,
  borderBottomWidth: worldShape.border,
  borderColor: world.line,
  minHeight: 52,
}
const $barButton: ViewStyle = {
  minWidth: 72,
  minHeight: 44,
  justifyContent: "center",
  paddingHorizontal: 8,
}
const $barTitle: TextStyle = { color: world.ink, fontSize: 16, lineHeight: 22 }
const $content: ViewStyle = { padding: 20, gap: 14, paddingBottom: 32 }
const $choice: ViewStyle = {
  padding: 2,
  borderRadius: worldShape.smallRadius,
  borderColor: "transparent",
  borderWidth: worldShape.border,
}
const $selected: ViewStyle = { borderColor: world.forest }
const $footer: ViewStyle = {
  padding: 16,
  borderTopWidth: worldShape.border,
  borderColor: world.line,
  backgroundColor: world.paper,
}

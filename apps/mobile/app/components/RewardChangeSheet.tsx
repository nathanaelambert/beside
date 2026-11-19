import { useEffect, useState } from "react"
import { Modal, Pressable, ScrollView, TextStyle, View, ViewStyle } from "react-native"
import type { RewardItem } from "@beside/rewards"
import { SafeAreaView } from "react-native-safe-area-context"

import { world, worldEyebrow, worldShape } from "@/theme/world"
import type { Cadence } from "@/utils/rewardChoice"

import { activityWorldStyles, WorldButton } from "./ActivityWorld"
import { RewardPicker } from "./RewardPicker"
import { Text } from "./Text"

/** Suggest a different reward for a milestone that nobody has checked in to yet. */
export function RewardChangeSheet({
  visible,
  milestoneName,
  items,
  initial,
  cadence,
  counts,
  rosterNames,
  saving,
  error,
  onCancel,
  onSave,
}: {
  visible: boolean
  milestoneName: string
  items: RewardItem[]
  initial: string | null
  cadence: Cadence
  counts: Map<string, number>
  rosterNames: string[]
  saving: boolean
  error?: string
  onCancel: () => void
  onSave: (itemId: string | null) => void
}) {
  const [value, setValue] = useState(initial)
  useEffect(() => {
    if (visible) setValue(initial)
  }, [visible, initial])
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
          <Text text="Suggest a reward" weight="semiBold" style={$barTitle} />
          <View style={$barButton} />
        </View>
        <ScrollView contentContainerStyle={$content}>
          <Text text={milestoneName.toUpperCase()} style={worldEyebrow} />
          <Text
            text="Your suggestion replaces the current pick. Everyone else can agree to it before the first check-in."
            style={activityWorldStyles.body}
          />
          <RewardPicker
            items={items}
            value={value}
            onChange={setValue}
            cadence={cadence}
            counts={counts}
            rosterNames={rosterNames}
          />
          {!!error && (
            <Text text={error} accessibilityRole="alert" style={activityWorldStyles.error} />
          )}
        </ScrollView>
        <View style={$footer}>
          <WorldButton
            text={saving ? "Saving…" : value === initial ? "Keep this reward" : "Suggest this"}
            testID="reward-change-save"
            preset="filled"
            disabled={saving}
            onPress={() => (value === initial ? onCancel() : onSave(value))}
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
const $footer: ViewStyle = {
  padding: 16,
  borderTopWidth: worldShape.border,
  borderColor: world.line,
  backgroundColor: world.paper,
}

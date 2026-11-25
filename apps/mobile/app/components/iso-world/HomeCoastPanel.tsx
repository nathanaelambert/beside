import { Pressable, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { WorldButton } from "@/components/ActivityWorld"
import { Text } from "@/components/Text"
import { world, worldEyebrow, worldShape } from "@/theme/world"

export function HomeCoastAction({
  count,
  done,
  disabled,
  notice,
  onOpen,
}: {
  count: number
  done: boolean
  disabled: boolean
  notice: string
  onOpen: () => void
}) {
  const label = done ? "Coast complete" : "Expand coast"
  return (
    <View style={styles.coastControls}>
      <Pressable
        testID="homebase-expand-coast"
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${count} tiles saved`}
        disabled={disabled || done}
        style={[styles.coastButton, (disabled || done) && styles.disabled]}
        onPress={onOpen}
      >
        <Text text={label} style={styles.buttonText} />
      </Pressable>
      {!!notice && (
        <Text
          testID="homebase-expansion-status"
          text={notice}
          style={styles.notice}
          accessibilityLiveRegion="polite"
        />
      )}
    </View>
  )
}

export function HomeCoastPanel({
  count,
  index,
  choices,
  saving,
  error,
  onNext,
  onCancel,
  onConfirm,
}: {
  count: number
  index: number
  choices: number
  saving: boolean
  error: string
  onNext: () => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.panel, { bottom: insets.bottom + 12 }]} testID="homebase-expansion-panel">
      <Text text="SHARED SHORELINE" style={worldEyebrow} />
      <Text
        text="Expand the coast"
        weight="semiBold"
        style={styles.title}
        accessibilityRole="header"
      />
      <Text
        text={
          index === -1
            ? "That tile was added by a member. Choose another or cancel."
            : `Preview ${index + 1} of ${choices} · ${count} saved. Tap a marked tile or choose Next tile.`
        }
        style={styles.copy}
        accessibilityLiveRegion="polite"
      />
      {!!error && <Text text={error} style={styles.error} accessibilityRole="alert" />}
      <View style={styles.actions}>
        <WorldButton
          text="Cancel"
          testID="homebase-expansion-cancel"
          disabled={saving}
          onPress={onCancel}
        />
        <WorldButton
          text="Next tile"
          testID="homebase-expansion-next"
          disabled={saving || choices === 0 || (choices === 1 && index === 0)}
          onPress={onNext}
        />
        <WorldButton
          text={saving ? "Saving…" : "Add one tile"}
          testID="homebase-expansion-confirm"
          preset="filled"
          disabled={saving || index < 0}
          onPress={onConfirm}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" },
  buttonText: { color: world.text, fontSize: 13, lineHeight: 20 },
  coastButton: {
    alignItems: "center",
    backgroundColor: world.panel,
    borderColor: world.line,
    borderRadius: worldShape.smallRadius,
    borderWidth: worldShape.border,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
  },
  coastControls: { alignItems: "flex-end", gap: 4, position: "absolute", right: 12, top: 12 },
  copy: { color: world.muted, fontSize: 13, lineHeight: 18 },
  disabled: { opacity: 0.45 },
  error: { color: world.error, fontSize: 13, lineHeight: 18 },
  notice: {
    backgroundColor: world.panel,
    borderRadius: worldShape.smallRadius,
    color: world.ink,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  panel: {
    alignSelf: "center",
    backgroundColor: world.panel,
    borderColor: world.meadowBorder,
    borderRadius: 14,
    borderWidth: 1,
    boxShadow: "0 6px 20px rgba(52, 75, 61, 0.16)",
    gap: 8,
    maxWidth: 440,
    padding: 14,
    position: "absolute",
    width: "94%",
    zIndex: 1,
  },
  title: { color: world.ink, fontSize: 20, lineHeight: 24 },
})

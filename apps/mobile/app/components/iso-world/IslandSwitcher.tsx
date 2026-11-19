import { Pressable, ScrollView, StyleSheet } from "react-native"
import type { ApiHomebase } from "@beside/api-client"

import { Text } from "@/components/Text"
import { world, worldShape } from "@/theme/world"

export function IslandSwitcher({
  bases,
  focusedId,
  disabled,
  onTravel,
}: {
  bases: ApiHomebase[]
  focusedId?: string
  disabled: boolean
  onTravel: (id: string) => void
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {bases.map((base) => (
        <Pressable
          key={base.id}
          accessibilityRole="button"
          accessibilityLabel={
            base.id === focusedId ? `${base.name}, you are here` : `Sail to ${base.name}`
          }
          accessibilityState={{ selected: base.id === focusedId, disabled }}
          disabled={disabled}
          onPress={() => onTravel(base.id)}
          style={({ pressed }) => [
            styles.chip,
            base.id === focusedId && styles.focused,
            pressed && styles.pressed,
            disabled && styles.disabled,
          ]}
        >
          <Text
            text={`${base.id === focusedId ? "• " : ""}${base.name}`}
            style={[styles.text, base.id === focusedId && styles.focusedText]}
            numberOfLines={1}
          />
        </Pressable>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: world.panel,
    borderColor: world.line,
    borderRadius: worldShape.smallRadius,
    borderWidth: worldShape.border,
    justifyContent: "center",
    maxWidth: 180,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  disabled: { opacity: 0.6 },
  focused: { backgroundColor: world.forest, borderColor: world.forest },
  focusedText: { color: world.onForest },
  pressed: { opacity: 0.75 },
  row: { gap: 8, paddingTop: 10 },
  text: { color: world.text, fontSize: 12, lineHeight: 18 },
})

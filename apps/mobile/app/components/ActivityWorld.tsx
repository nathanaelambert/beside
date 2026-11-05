import { Pressable, TextStyle, View, ViewStyle } from "react-native"
import type { PixelArt } from "@beside/rewards"
import { SafeAreaView } from "react-native-safe-area-context"

import { world, worldEyebrow, worldShape } from "@/theme/world"

import { PixelArtSprite } from "./BesideMark"
import { Button, type ButtonProps } from "./Button"
import { Text } from "./Text"
import { TextField, type TextFieldProps } from "./TextField"

export function WorldButton({
  style,
  textStyle,
  preset,
  secondary,
  ...props
}: ButtonProps & { secondary?: boolean }) {
  const selected = preset === "filled" || preset === "reversed"
  return (
    <Button
      {...props}
      preset="default"
      style={[
        $control,
        selected && $primary,
        secondary && $secondary,
        props.disabled && $disabled,
        style,
      ]}
      textStyle={[$buttonText, selected && $onForest, textStyle]}
      pressedStyle={selected ? $primary : $control}
      pressedTextStyle={selected ? $onForest : $buttonText}
    />
  )
}

export function WorldTextField({
  style,
  inputWrapperStyle,
  LabelTextProps,
  HelperTextProps,
  ...props
}: TextFieldProps) {
  return (
    <TextField
      {...props}
      style={[$inputText, style]}
      inputWrapperStyle={[$input, inputWrapperStyle]}
      placeholderTextColor={world.muted}
      selectionColor={world.forest}
      LabelTextProps={{ ...LabelTextProps, style: [$label, LabelTextProps?.style] }}
      HelperTextProps={{
        ...HelperTextProps,
        style: [activityWorldStyles.muted, HelperTextProps?.style],
      }}
    />
  )
}

export function ActivityWorldHeader({
  text = "Back",
  onPress,
}: {
  text?: string
  onPress?: () => void
}) {
  return (
    <SafeAreaView edges={["top"]} style={activityWorldStyles.page}>
      <Pressable
        testID="activity-world-back"
        accessibilityRole="button"
        accessibilityLabel={text}
        disabled={!onPress}
        onPress={onPress}
        style={$back}
      >
        <Text text={`‹  ${text}`} style={$buttonText} />
      </Pressable>
    </SafeAreaView>
  )
}

const calendar: PixelArt = {
  format: "pixel-art",
  palette: { f: world.forest, p: world.onForest, l: world.leaf },
  pixels: [
    "..f...f..",
    ".fffffff.",
    ".fpppppf.",
    ".fpfpfpf.",
    ".fpppppf.",
    ".fpfplpf.",
    ".fpppppf.",
    ".fffffff.",
    ".........",
  ],
}

export function WorldSchedulePanel({
  name,
  summary,
  timeZone,
  testID,
}: {
  name: string
  summary: string
  timeZone: string
  testID: string
}) {
  return (
    <View style={$schedulePanel}>
      <View style={$scheduleHeading}>
        <PixelArtSprite art={calendar} scale={3} />
        <View style={$scheduleTitle}>
          <Text text="MILESTONE SCHEDULE" style={worldEyebrow} />
          <Text text={name} weight="semiBold" style={activityWorldStyles.sectionTitle} />
        </View>
      </View>
      <Text text={summary} testID={testID} style={activityWorldStyles.body} />
      <Text text={`Eastern Time · ${timeZone}`} style={activityWorldStyles.muted} />
    </View>
  )
}

export const activityWorldStyles = {
  page: { backgroundColor: world.paper } satisfies ViewStyle,
  root: { flex: 1, backgroundColor: world.paper } satisfies ViewStyle,
  content: { paddingHorizontal: 20, paddingBottom: 28, paddingTop: 8, gap: 20 } satisfies ViewStyle,
  title: { color: world.ink, fontSize: 26, lineHeight: 32 } satisfies TextStyle,
  sectionTitle: { color: world.ink, fontSize: 16, lineHeight: 23 } satisfies TextStyle,
  body: { color: world.text, fontSize: 14, lineHeight: 22 } satisfies TextStyle,
  muted: { color: world.muted, fontSize: 12, lineHeight: 19 } satisfies TextStyle,
  error: { color: world.error, fontSize: 14, lineHeight: 22 } satisfies TextStyle,
}

const $control: ViewStyle = {
  backgroundColor: world.panel,
  borderWidth: worldShape.border,
  borderColor: world.line,
  borderRadius: worldShape.radius,
  minHeight: worldShape.control,
  paddingHorizontal: 14,
}
const $primary: ViewStyle = { backgroundColor: world.forest, borderColor: world.forest }
const $secondary: ViewStyle = { backgroundColor: world.paper, borderWidth: 0 }
const $disabled: ViewStyle = { opacity: 0.45 }
const $buttonText: TextStyle = { color: world.text, fontSize: 14, lineHeight: 22 }
const $onForest: TextStyle = { color: world.onForest }
const $input: ViewStyle = {
  backgroundColor: world.panel,
  borderColor: world.line,
  borderWidth: worldShape.border,
  borderRadius: worldShape.radius,
  minHeight: worldShape.control,
  justifyContent: "center",
}
const $inputText: TextStyle = { color: world.text }
const $label: TextStyle = { color: world.muted, fontSize: 12, lineHeight: 18 }
const $back: ViewStyle = {
  minHeight: worldShape.control,
  paddingHorizontal: 20,
  justifyContent: "center",
  alignSelf: "flex-start",
}
const $schedulePanel: ViewStyle = {
  backgroundColor: world.meadow,
  borderWidth: worldShape.border,
  borderColor: world.line,
  borderRadius: worldShape.radius,
  padding: 16,
  gap: 10,
}
const $scheduleHeading: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 12 }
const $scheduleTitle: ViewStyle = { flex: 1, gap: 3 }

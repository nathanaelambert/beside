import { forwardRef, ReactNode, Ref } from "react"
// eslint-disable-next-line no-restricted-imports
import { ActivityIndicator, TextInput, TextStyle, View, ViewStyle } from "react-native"

import { BesideMark } from "@/components/BesideMark"
import { Button } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField, TextFieldProps } from "@/components/TextField"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { world, worldShape } from "@/theme/world"

interface AuthLayoutProps {
  title: string
  description: string
  children: ReactNode
}

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  const { themed } = useAppTheme()
  return (
    <Screen
      preset="auto"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($page)}
      backgroundColor={world.paper}
    >
      <View style={themed($hero)}>
        <BesideMark scale={7} animated />
        <View style={themed($ground)} />
      </View>
      <View style={themed($intro)}>
        <Text text="beside" weight="bold" style={themed($wordmark)} />
        <Text text="A little closer, at your own pace." style={themed($tagline)} />
      </View>
      <View style={themed($card)}>
        <Text text={title} testID="login-heading" preset="subheading" style={$heading} />
        <Text text={description} style={themed([$muted, $description])} />
        {children}
      </View>
    </Screen>
  )
}

export const AuthField = forwardRef(function AuthField(props: TextFieldProps, ref: Ref<TextInput>) {
  const { themed } = useAppTheme()
  return (
    <TextField
      ref={ref}
      autoCorrect={false}
      containerStyle={themed($field)}
      inputWrapperStyle={themed($input)}
      style={$inputText}
      LabelTextProps={{ style: $label }}
      placeholderTextColor={world.muted}
      {...props}
    />
  )
})

export function AuthError({ message, testID }: { message: string; testID: string }) {
  const { themed } = useAppTheme()
  if (!message) return null
  return (
    <Text
      testID={testID}
      text={message}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={themed($error)}
    />
  )
}

interface AuthSubmitProps {
  testID: string
  text: string
  busyText: string
  busy: boolean
  onPress: () => void
}

export function AuthSubmit({ testID, text, busyText, busy, onPress }: AuthSubmitProps) {
  const { themed } = useAppTheme()
  return (
    <Button
      testID={testID}
      text={busy ? busyText : text}
      preset="reversed"
      onPress={onPress}
      disabled={busy}
      style={themed($button)}
      textStyle={$buttonText}
      pressedStyle={$buttonPressed}
      RightAccessory={
        busy
          ? () => (
              <ActivityIndicator
                accessibilityLabel={busyText}
                color={world.onForest}
                style={themed($progress)}
              />
            )
          : undefined
      }
    />
  )
}

interface AuthSwitchLinkProps {
  testID: string
  prompt: string
  action: string
  onPress: () => void
}

/** "New to Beside? Create an account"-style link between the signed-out screens. */
export function AuthSwitchLink({ testID, prompt, action, onPress }: AuthSwitchLinkProps) {
  const { themed } = useAppTheme()
  return (
    <Text testID={testID} accessibilityRole="button" onPress={onPress} style={themed($switch)}>
      <Text text={`${prompt} `} style={themed($muted)} />
      <Text text={action} weight="bold" style={$link} />
    </Text>
  )
}

const $page: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.lg,
  paddingBottom: spacing.xl,
  flexGrow: 1,
})
const $hero: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  height: 212,
  borderRadius: spacing.lg,
  backgroundColor: world.panel,
  alignItems: "center",
  justifyContent: "flex-end",
  overflow: "hidden",
  paddingBottom: 28,
})
const $ground: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: 28,
  backgroundColor: "#95b46b",
  borderTopWidth: 4,
  borderTopColor: "#7e9d5a",
})
const $intro: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  marginTop: spacing.lg,
  marginBottom: spacing.lg,
  gap: spacing.xxs,
})
const $wordmark: ThemedStyle<TextStyle> = () => ({
  color: world.forest,
  fontSize: 44,
  lineHeight: 52,
  letterSpacing: -1.5,
})
const $tagline: ThemedStyle<TextStyle> = () => ({
  color: world.muted,
  fontSize: 17,
  lineHeight: 24,
})
const $card: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  backgroundColor: world.panel,
  borderRadius: spacing.lg,
  padding: spacing.lg,
  borderWidth: 1,
  borderColor: world.line,
})
const $muted: ThemedStyle<TextStyle> = () => ({ color: world.muted })
const $description: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginTop: spacing.xxxs,
  marginBottom: spacing.lg,
})
const $field: ThemedStyle<ViewStyle> = ({ spacing }) => ({ marginBottom: spacing.md })
const $input: ThemedStyle<ViewStyle> = () => ({
  borderRadius: worldShape.radius,
  backgroundColor: world.paper,
  borderColor: world.line,
  minHeight: 52,
  alignItems: "center",
})
const $button: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.xs,
  minHeight: 56,
  borderRadius: worldShape.radius,
  borderWidth: 0,
  backgroundColor: world.forest,
})
const $buttonText: TextStyle = { color: world.onForest }
const $buttonPressed: ViewStyle = { backgroundColor: world.ink }
const $heading: TextStyle = { color: world.ink }
const $label: TextStyle = { color: world.text }
const $inputText: TextStyle = { color: world.ink }
const $error: ThemedStyle<TextStyle> = ({ spacing }) => ({
  color: world.error,
  marginBottom: spacing.sm,
})
const $progress: ThemedStyle<ViewStyle> = ({ spacing }) => ({ marginLeft: spacing.xs })
const $switch: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginTop: spacing.md,
  paddingVertical: spacing.xs,
  textAlign: "center",
})
const $link: TextStyle = { color: world.forest }

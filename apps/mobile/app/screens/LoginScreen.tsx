import { useRef, useState } from "react"
// eslint-disable-next-line no-restricted-imports
import { ActivityIndicator, Keyboard, TextInput, TextStyle, View, ViewStyle } from "react-native"

import { BesideMark } from "@/components/BesideMark"
import { Button } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useAuth } from "@/context/AuthContext"
import { besideApi } from "@/services/api/beside"
import { loginValidation } from "@/services/auth/validation"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { world, worldShape } from "@/theme/world"

export function LoginScreen() {
  const passwordInput = useRef<TextInput>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const { completeSignIn } = useAuth()
  const { themed } = useAppTheme()

  async function login() {
    if (busy) return
    const validation = loginValidation(email, password)
    setError(validation)
    if (validation) return
    Keyboard.dismiss()
    setBusy(true)
    try {
      const session = await besideApi.login({ email: email.trim(), password })
      await completeSignIn(session)
      setPassword("")
    } catch (cause) {
      setError(
        cause instanceof Error && cause.name !== "AbortError"
          ? cause.message
          : "We couldn’t connect. Check your connection and try again.",
      )
    } finally {
      setBusy(false)
    }
  }

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
        <Text text="Welcome back" testID="login-heading" preset="subheading" style={$heading} />
        <Text text="Log in to your home base." style={themed([$muted, $description])} />
        <TextField
          testID="login-email"
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          editable={!busy}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => passwordInput.current?.focus()}
          containerStyle={themed($field)}
          inputWrapperStyle={themed($input)}
          style={$inputText}
          LabelTextProps={{ style: $label }}
          placeholderTextColor={world.muted}
        />
        <TextField
          ref={passwordInput}
          testID="login-password"
          label="Password"
          placeholder="Your password"
          value={password}
          onChangeText={setPassword}
          editable={!busy}
          autoCapitalize="none"
          autoComplete="password"
          autoCorrect={false}
          secureTextEntry
          returnKeyType="go"
          onSubmitEditing={login}
          containerStyle={themed($field)}
          inputWrapperStyle={themed($input)}
          style={$inputText}
          LabelTextProps={{ style: $label }}
          placeholderTextColor={world.muted}
        />
        {!!error && (
          <Text
            testID="login-error"
            text={error}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={themed($error)}
          />
        )}
        <Button
          testID="login-button"
          text={busy ? "Logging in…" : "Log in"}
          preset="reversed"
          onPress={login}
          disabled={busy}
          style={themed($button)}
          textStyle={$buttonText}
          pressedStyle={$buttonPressed}
          RightAccessory={
            busy
              ? () => (
                  <ActivityIndicator
                    accessibilityLabel="Logging in"
                    color={world.onForest}
                    style={themed($progress)}
                  />
                )
              : undefined
          }
        />
      </View>
    </Screen>
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

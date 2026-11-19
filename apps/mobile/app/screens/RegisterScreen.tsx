import { useRef, useState } from "react"
// eslint-disable-next-line no-restricted-imports
import { TextInput } from "react-native"

import {
  AuthError,
  AuthField,
  AuthLayout,
  AuthSubmit,
  AuthSwitchLink,
} from "@/components/AuthLayout"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { besideApi } from "@/services/api/beside"
import { useAuthForm } from "@/services/auth/useAuthForm"
import { MIN_PASSWORD_LENGTH, registerValidation } from "@/services/auth/validation"

export function RegisterScreen({ navigation }: AppStackScreenProps<"Register">) {
  const emailInput = useRef<TextInput>(null)
  const passwordInput = useRef<TextInput>(null)
  const inviteInput = useRef<TextInput>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const { busy, error, submit } = useAuthForm()

  function register() {
    const invite = inviteCode.trim()
    return submit(registerValidation(name, email, password), () =>
      besideApi.register({
        name: name.trim(),
        email: email.trim(),
        password,
        ...(invite ? { inviteCode: invite } : {}),
      }),
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Start a new home base, or join one with an invite code."
    >
      <AuthField
        testID="register-name"
        label="Name"
        placeholder="What should we call you?"
        value={name}
        onChangeText={setName}
        editable={!busy}
        autoCapitalize="words"
        autoComplete="name"
        returnKeyType="next"
        onSubmitEditing={() => emailInput.current?.focus()}
      />
      <AuthField
        ref={emailInput}
        testID="register-email"
        label="Email"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        editable={!busy}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => passwordInput.current?.focus()}
      />
      <AuthField
        ref={passwordInput}
        testID="register-password"
        label="Password"
        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        value={password}
        onChangeText={setPassword}
        editable={!busy}
        autoCapitalize="none"
        autoComplete="new-password"
        secureTextEntry
        returnKeyType="next"
        onSubmitEditing={() => inviteInput.current?.focus()}
      />
      <AuthField
        ref={inviteInput}
        testID="register-invite"
        label="Invite code (optional)"
        placeholder="Leave empty to start a new home base"
        value={inviteCode}
        onChangeText={setInviteCode}
        editable={!busy}
        autoCapitalize="none"
        returnKeyType="go"
        onSubmitEditing={register}
      />
      <AuthError testID="register-error" message={error} />
      <AuthSubmit
        testID="register-button"
        text="Create account"
        busyText="Creating account…"
        busy={busy}
        onPress={register}
      />
      <AuthSwitchLink
        testID="go-to-login"
        prompt="Already have an account?"
        action="Log in"
        onPress={() => navigation.goBack()}
      />
    </AuthLayout>
  )
}

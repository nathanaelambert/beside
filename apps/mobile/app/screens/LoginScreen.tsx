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
import { loginValidation } from "@/services/auth/validation"

export function LoginScreen({ navigation }: AppStackScreenProps<"Login">) {
  const passwordInput = useRef<TextInput>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const { busy, error, submit } = useAuthForm()

  async function login() {
    const signedIn = await submit(loginValidation(email, password), () =>
      besideApi.login({ email: email.trim(), password }),
    )
    if (signedIn) setPassword("")
  }

  return (
    <AuthLayout title="Welcome back" description="Log in to your home base.">
      <AuthField
        testID="login-email"
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
        testID="login-password"
        label="Password"
        placeholder="Your password"
        value={password}
        onChangeText={setPassword}
        editable={!busy}
        autoCapitalize="none"
        autoComplete="password"
        secureTextEntry
        returnKeyType="go"
        onSubmitEditing={login}
      />
      <AuthError testID="login-error" message={error} />
      <AuthSubmit
        testID="login-button"
        text="Log in"
        busyText="Logging in…"
        busy={busy}
        onPress={login}
      />
      <AuthSwitchLink
        testID="go-to-guest"
        prompt="Have an invite?"
        action="Join as a guest"
        onPress={() => navigation.navigate("GuestJoin")}
      />
      <AuthSwitchLink
        testID="go-to-register"
        prompt="New to Beside?"
        action="Create an account"
        onPress={() => navigation.navigate("Register")}
      />
    </AuthLayout>
  )
}

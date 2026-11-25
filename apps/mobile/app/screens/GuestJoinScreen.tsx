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
import {
  guestValidation,
  MAX_GUEST_INVITE_LENGTH,
  MAX_GUEST_NAME_LENGTH,
} from "@/services/auth/validation"

export function GuestJoinScreen({ navigation }: AppStackScreenProps<"GuestJoin">) {
  const inviteInput = useRef<TextInput>(null)
  const [name, setName] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const { busy, error, submit } = useAuthForm()

  function join() {
    return submit(guestValidation(name, inviteCode), () =>
      besideApi.joinAsGuest({ name: name.trim(), inviteCode: inviteCode.trim() }),
    )
  }

  return (
    <AuthLayout
      title="Join as a guest"
      description="Visit a friend’s island and make your avatar your own. No email or password needed. You can return on this device until you sign out or your visit expires."
    >
      <AuthField
        testID="guest-name"
        label="Display name"
        placeholder="What should we call you?"
        value={name}
        maxLength={MAX_GUEST_NAME_LENGTH}
        onChangeText={setName}
        editable={!busy}
        autoCapitalize="words"
        autoComplete="nickname"
        returnKeyType="next"
        onSubmitEditing={() => inviteInput.current?.focus()}
      />
      <AuthField
        ref={inviteInput}
        testID="guest-invite"
        label="Invite code"
        placeholder="Paste the code from your host"
        value={inviteCode}
        maxLength={MAX_GUEST_INVITE_LENGTH}
        onChangeText={setInviteCode}
        editable={!busy}
        autoCapitalize="none"
        autoComplete="off"
        returnKeyType="go"
        onSubmitEditing={join}
      />
      <AuthError testID="guest-error" message={error} />
      <AuthSubmit
        testID="guest-join-button"
        text="Visit the island"
        busyText="Joining…"
        busy={busy}
        onPress={join}
      />
      <AuthSwitchLink
        testID="guest-back-to-login"
        prompt="Already have an account?"
        action="Log in"
        onPress={() => navigation.goBack()}
      />
    </AuthLayout>
  )
}

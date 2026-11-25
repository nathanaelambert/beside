import { useRef, useState } from "react"
// eslint-disable-next-line no-restricted-imports
import { Keyboard } from "react-native"
import type { AuthSession } from "@beside/api-client"

import { useAuth } from "@/context/AuthContext"

/**
 * Busy/error state shared by the signed-out forms. `submit` validates, calls the API,
 * and signs in with the returned session.
 */
export function useAuthForm() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  // `busy` state lags a render behind, so two submits in the same tick (a double tap, or
  // Android firing onSubmitEditing twice for a hardware Enter) would both pass it.
  const inFlight = useRef(false)
  const { completeSignIn } = useAuth()

  async function submit(validation: string, request: () => Promise<AuthSession>) {
    if (inFlight.current) return false
    setError(validation)
    if (validation) return false
    inFlight.current = true
    Keyboard.dismiss()
    setBusy(true)
    try {
      await completeSignIn(await request())
      return true
    } catch (cause) {
      setError(
        cause instanceof Error && cause.name !== "AbortError"
          ? cause.message
          : "We couldn’t connect. Check your connection and try again.",
      )
      return false
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return { busy, error, submit }
}

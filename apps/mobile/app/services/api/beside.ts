import { BesideClient } from "@beside/api-client"

// Public API origin only. Store the bearer token in the app's secure credential
// store when adding the sign-in flow, then call besideApi.setToken(token).
export const besideApi = new BesideClient(
  process.env.EXPO_PUBLIC_BESIDE_API_URL || "http://localhost:3001",
)

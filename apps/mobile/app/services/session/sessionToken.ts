import * as SecureStore from "expo-secure-store"

const SESSION_KEY = "beside.session-token"

/** Native: the session token lives in the device keychain / keystore. */
export const sessionToken = {
  get: () => SecureStore.getItemAsync(SESSION_KEY),
  set: (token: string) =>
    SecureStore.setItemAsync(SESSION_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  clear: () => SecureStore.deleteItemAsync(SESSION_KEY),
}

import * as SecureStore from "expo-secure-store"
import type { Session } from "@beside/api-client"
import { act, renderHook, waitFor } from "@testing-library/react-native"

import { besideApi } from "@/services/api/beside"

import { AuthProvider, useAuth } from "./AuthContext"

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "device-only",
}))
jest.mock("@/services/api/beside", () => ({
  besideApi: { setToken: jest.fn(), me: jest.fn(), logout: jest.fn() },
}))
jest.mock("@/utils/storage", () => ({ remove: jest.fn() }))

const profile: Session["user"] = {
  id: "user1",
  name: "Example Member",
  email: "member@example.com",
  color: "blue",
}
const session: Session = { user: profile, token: "test-session", expiresAt: "2030-01-01T00:00:00Z" }

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null)
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined)
  jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined)
  jest.mocked(besideApi.logout).mockResolvedValue(undefined)
})

it("restores a stored session only after validating it with the API", async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue("stored-session")
  jest.mocked(besideApi.me).mockResolvedValue(profile)
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })
  expect(result.current.isAuthenticated).toBe(false)
  await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
  expect(besideApi.setToken).toHaveBeenCalledWith("stored-session")
  expect(result.current.user).toEqual(profile)
})

it("clears an expired token but preserves one after a network failure", async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue("expired")
  jest.mocked(besideApi.me).mockRejectedValue(Object.assign(new Error("Expired"), { status: 401 }))
  const expired = renderHook(() => useAuth(), { wrapper: AuthProvider })
  await waitFor(() => expect(expired.result.current.isRestoring).toBe(false))
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("beside.session-token")
  expect(expired.result.current.isAuthenticated).toBe(false)
  expired.unmount()
  jest.clearAllMocks()
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue("valid-offline")
  jest.mocked(besideApi.me).mockRejectedValue(new Error("Offline"))
  const offline = renderHook(() => useAuth(), { wrapper: AuthProvider })
  await waitFor(() => expect(offline.result.current.restoreError).not.toBe(""))
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled()
  expect(offline.result.current.isAuthenticated).toBe(false)
  jest.mocked(besideApi.me).mockResolvedValue(profile)
  act(() => offline.result.current.retryRestore())
  await waitFor(() => expect(offline.result.current.isAuthenticated).toBe(true))
})

it("saves the token in SecureStore and clears it when logging out offline", async () => {
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })
  await waitFor(() => expect(result.current.isRestoring).toBe(false))
  await act(async () => result.current.completeSignIn(session))
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith("beside.session-token", "test-session", {
    keychainAccessible: "device-only",
  })
  expect(result.current.isAuthenticated).toBe(true)
  jest.mocked(besideApi.logout).mockRejectedValue(new Error("Offline"))
  await act(async () => result.current.logout())
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("beside.session-token")
  expect(besideApi.setToken).toHaveBeenLastCalledWith(null)
  expect(result.current.user).toBeNull()
})

it("does not sign in when secure storage fails", async () => {
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })
  await waitFor(() => expect(result.current.isRestoring).toBe(false))
  jest.mocked(SecureStore.setItemAsync).mockRejectedValue(new Error("Storage unavailable"))
  await act(async () => {
    await expect(result.current.completeSignIn(session)).rejects.toThrow("securely save")
  })
  expect(besideApi.logout).toHaveBeenCalled()
  expect(result.current.isAuthenticated).toBe(false)
})

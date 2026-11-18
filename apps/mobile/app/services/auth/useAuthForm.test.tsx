import type { Session } from "@beside/api-client"
import { act, renderHook } from "@testing-library/react-native"

import { useAuthForm } from "./useAuthForm"

const mockCompleteSignIn = jest.fn()
jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ completeSignIn: mockCompleteSignIn }),
}))

const session: Session = {
  user: { id: "user1", name: "Example Member", email: "member@example.com", color: "blue" },
  token: "test-session",
  expiresAt: "2030-01-01T00:00:00Z",
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCompleteSignIn.mockResolvedValue(undefined)
})

it("sends one request when submitted twice in the same tick", async () => {
  const request = jest.fn().mockResolvedValue(session)
  const { result } = renderHook(() => useAuthForm())

  await act(async () => {
    await Promise.all([result.current.submit("", request), result.current.submit("", request)])
  })

  expect(request).toHaveBeenCalledTimes(1)
  expect(mockCompleteSignIn).toHaveBeenCalledTimes(1)
  expect(mockCompleteSignIn).toHaveBeenCalledWith(session)
})

it("shows validation errors without calling the API", async () => {
  const request = jest.fn()
  const { result } = renderHook(() => useAuthForm())

  await act(async () => {
    await result.current.submit("Enter your name.", request)
  })

  expect(request).not.toHaveBeenCalled()
  expect(result.current.error).toBe("Enter your name.")
})

it("shows the API's message and allows a retry after a failure", async () => {
  const request = jest
    .fn()
    .mockRejectedValueOnce(new Error("An account with this email already exists."))
    .mockResolvedValueOnce(session)
  const { result } = renderHook(() => useAuthForm())

  await act(async () => {
    await result.current.submit("", request)
  })
  expect(result.current.error).toBe("An account with this email already exists.")
  expect(result.current.busy).toBe(false)

  await act(async () => {
    await result.current.submit("", request)
  })
  expect(request).toHaveBeenCalledTimes(2)
  expect(mockCompleteSignIn).toHaveBeenCalledWith(session)
})

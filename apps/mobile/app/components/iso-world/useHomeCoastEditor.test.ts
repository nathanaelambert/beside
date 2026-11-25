import type { HomebaseExpansion } from "@beside/api-client/homebase-expansion"
import { act, renderHook } from "@testing-library/react-native"

import { besideApi } from "@/services/api/beside"

import { useHomeCoastEditor } from "./useHomeCoastEditor"

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback: () => void) =>
    jest.requireActual("react").useEffect(callback, [callback]),
}))
jest.mock("@/services/api/beside", () => ({ besideApi: { expandHomebase: jest.fn() } }))

it("cannot submit a stale island's selection after a route change", async () => {
  const accept = jest.fn()
  const empty: HomebaseExpansion = { additions: [] }
  const { result, rerender } = renderHook(
    ({ id }: { id: string }) => useHomeCoastEditor(id, empty, accept),
    { initialProps: { id: "first" } },
  )
  act(() => result.current.select(result.current.candidates[0]))
  const confirmOld = result.current.confirm
  rerender({ id: "second" })
  expect(result.current.draft).toBeUndefined()
  await act(async () => confirmOld())
  expect(besideApi.expandHomebase).not.toHaveBeenCalled()
  expect(accept).not.toHaveBeenCalled()
})

import { act, renderHook } from "@testing-library/react-native"

import { useRewardCountdown } from "./useRewardCountdown"

afterEach(() => jest.useRealTimers())

it("counts only while visible and stops scheduling at the exact deadline", () => {
  jest.useFakeTimers()
  const deadline = performance.now() + 2500
  const { result, rerender } = renderHook(
    ({ visible }: { visible: boolean }) => useRewardCountdown(deadline, visible),
    {
      initialProps: { visible: false },
    },
  )
  expect(result.current).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
  rerender({ visible: true })
  expect(result.current).toBe(3)
  act(() => jest.advanceTimersByTime(500))
  expect(result.current).toBe(2)
  rerender({ visible: false })
  expect(jest.getTimerCount()).toBe(0)
  act(() => jest.advanceTimersByTime(1000))
  rerender({ visible: true })
  expect(result.current).toBe(1)
  act(() => jest.advanceTimersByTime(1000))
  expect(result.current).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
})

it("renders immediately finished when a snapshot arrives after construction", () => {
  jest.useFakeTimers()
  const { result } = renderHook(() => useRewardCountdown(performance.now() - 5000, true))
  expect(result.current).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
})

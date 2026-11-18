import { act, renderHook } from "@testing-library/react-native"
import { useReducedMotion } from "react-native-reanimated"

import { archipelagoLayout, type IslandLayer } from "./archipelago"
import { homeFrame } from "./scene"
import { meadowTileMap } from "./tilemap"
import { useArchipelagoTravel } from "./useArchipelagoTravel"
import { avatarsForMembers } from "../pixel-world/avatars"

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback: () => void) =>
    jest.requireActual("react").useEffect(callback, [callback]),
}))
jest.mock("react-native-reanimated", () => ({ useReducedMotion: jest.fn() }))

const offsets = archipelagoLayout(["project", "family", "crew"])
const layers: IslandLayer[] = Object.entries(offsets).map(([key, offset]) => ({
  key,
  offset,
  map: meadowTileMap(),
  frame: homeFrame,
  drawables: [],
}))
const avatar = avatarsForMembers([{ id: "you", name: "Mosaab" }])[0]!

beforeEach(() => {
  jest.mocked(useReducedMotion).mockReturnValue(false)
})

it("locks travel until the arrival callback, then changes focus exactly once", () => {
  const onArrive = jest.fn()
  const { result } = renderHook(() =>
    useArchipelagoTravel({ layers, focusedId: "project", avatar, arrivalZoom: 2, onArrive }),
  )
  act(() => {
    expect(result.current.travel("family")).toBe(true)
  })
  expect(onArrive).not.toHaveBeenCalled()
  expect(result.current.voyage?.avatar.key).toBe("you")
  const path = result.current.voyage?.path
  act(() => {
    expect(result.current.travel("crew")).toBe(false)
  })
  expect(result.current.voyage?.path).toBe(path)
  act(() => result.current.arrive())
  expect(onArrive).toHaveBeenCalledTimes(1)
  expect(onArrive).toHaveBeenCalledWith("family")
  expect(result.current.voyage).toBeUndefined()
  act(() => result.current.arrive())
  expect(onArrive).toHaveBeenCalledTimes(1)
})

it("cuts directly to the destination with reduced motion", () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const onArrive = jest.fn()
  const { result } = renderHook(() =>
    useArchipelagoTravel({ layers, focusedId: "project", avatar, arrivalZoom: 2, onArrive }),
  )
  act(() => {
    result.current.travel("family")
  })
  expect(onArrive).toHaveBeenCalledWith("family")
  expect(result.current.voyage).toBeUndefined()
})

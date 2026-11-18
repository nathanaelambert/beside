import { ApiError, type ApiHomebase, type ApiState } from "@beside/api-client"
import { act, renderHook, waitFor } from "@testing-library/react-native"

import { besideApi } from "@/services/api/beside"
import { loadString, saveString } from "@/utils/storage"

import { useHomeArchipelago } from "./useHomeArchipelago"

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback: () => void) =>
    jest.requireActual("react").useEffect(callback, [callback]),
}))
jest.mock("@/services/api/beside", () => ({
  besideApi: { homebases: jest.fn(), state: jest.fn(), homebaseGarden: jest.fn() },
}))
jest.mock("@/utils/storage", () => ({ loadString: jest.fn(), saveString: jest.fn() }))

const bases: ApiHomebase[] = [
  { id: "family", name: "Family", memberIds: ["you", "sam"], inviteCode: "unused" },
  { id: "project", name: "Project Beside", memberIds: ["you", "lee"], inviteCode: "unused" },
  { id: "crew", name: "Climbing crew", memberIds: ["you", "sam", "lee"], inviteCode: "unused" },
]
const state = {
  users: [
    { id: "you", name: "Mosaab" },
    { id: "sam", name: "Sam" },
    { id: "lee", name: "Lee" },
  ],
  activities: [
    { id: "a-family", name: "Read", connectionId: "family", createdAt: "2026-11-01" },
    { id: "a-project", name: "Build", connectionId: "project", createdAt: "2026-11-02" },
  ],
  rewards: [
    { id: "r-family", homebaseId: "family", itemId: "sunflower", obtainedAt: "2026-11-01" },
  ],
  milestones: [],
} as unknown as ApiState

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(loadString).mockReturnValue(null)
  jest.mocked(besideApi.homebases).mockResolvedValue(bases)
  jest.mocked(besideApi.state).mockResolvedValue(state)
  jest.mocked(besideApi.homebaseGarden).mockImplementation(async () => ({ oak: null }))
})

it("loads every garden and scopes members, cottages and rewards to each base", async () => {
  const { result } = renderHook(() => useHomeArchipelago("you", undefined, 0))
  await waitFor(() => expect(result.current.busy).toBe(false))
  // Membership order, not focus order: islands keep their places on the map.
  expect(result.current.islands.map((i) => i.homebase.id)).toEqual(["family", "project", "crew"])
  expect(jest.mocked(besideApi.homebaseGarden).mock.calls.map(([id]) => id)).toEqual([
    "family",
    "project",
    "crew",
  ])
  const family = result.current.islands.find((i) => i.homebase.id === "family")!
  const project = result.current.islands.find((i) => i.homebase.id === "project")!
  expect(family.members.map((member) => member.id)).toEqual(["you", "sam"])
  expect(family.scene.houses.map((house) => house.activity.id)).toEqual(["a-family"])
  expect(project.scene.houses.map((house) => house.activity.id)).toEqual(["a-project"])
  expect(family.layer.drawables.some((d) => d.key === "reward-r-family")).toBe(true)
  expect(project.layer.drawables.some((d) => d.key === "reward-r-family")).toBe(false)
  expect(family.layer.drawables.some((d) => d.key === "jetty")).toBe(true)
})

it("restores per-user focus, honors a route, and keeps positions fixed after travel", async () => {
  jest.mocked(loadString).mockReturnValue("crew")
  const { result, rerender } = renderHook(
    ({ connectionId }: { connectionId?: string }) => useHomeArchipelago("you", connectionId, 0),
    { initialProps: {} },
  )
  await waitFor(() => expect(result.current.busy).toBe(false))
  expect(loadString).toHaveBeenCalledWith("homebase.focus.you")
  expect(result.current.focused?.homebase.id).toBe("crew")
  const offsets = result.current.islands.map((i) => i.layer.offset)
  act(() => result.current.focusIsland("family"))
  expect(saveString).toHaveBeenLastCalledWith("homebase.focus.you", "family")
  expect(result.current.islands.map((i) => i.layer.offset)).toEqual(offsets)
  rerender({ connectionId: "project" })
  expect(result.current.focused?.homebase.id).toBe("project")
  expect(besideApi.homebases).toHaveBeenCalledTimes(1)
})

it("keeps the original single-island scene and refreshes only the planted garden data", async () => {
  jest.mocked(besideApi.homebases).mockResolvedValue([bases[0]!])
  const { result } = renderHook(() => useHomeArchipelago("you", "family", 0))
  await waitFor(() => expect(result.current.busy).toBe(false))
  const original = result.current.focused!
  expect(original.layer.offset).toEqual({ x: 0, y: 0 })
  expect(original.layer.sign).toBeUndefined()
  expect(original.layer.drawables).toBe(original.scene.drawables)
  act(() => result.current.updateGarden("family", { oak: { x: 72, y: 88, itemId: "oak-tree" } }))
  expect(result.current.focused?.scene.drawables.some((d) => d.key === "starter-oak")).toBe(true)
})

it("preserves other gardens when one request fails", async () => {
  jest.mocked(besideApi.homebaseGarden).mockImplementation(async (id) => {
    if (id === "family") throw new ApiError(500, "Unavailable")
    return { oak: null }
  })
  const { result } = renderHook(() => useHomeArchipelago("you", undefined, 0))
  await waitFor(() => expect(result.current.busy).toBe(false))
  expect(result.current.error).toContain("garden decorations")
  expect(result.current.islands.find((i) => i.homebase.id === "project")?.garden).toBeDefined()
  expect(result.current.islands).toHaveLength(3)
})

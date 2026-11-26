import type { EffectCallback } from "react"
import { AppState, type AppStateStatus } from "react-native"
import { ApiError, type ApiHomebase, type ApiState } from "@beside/api-client"
import { checkMeadowPlacement } from "@beside/api-client/garden"
import { act, fireEvent, render, waitFor } from "@testing-library/react-native"
import { useReducedMotion } from "react-native-reanimated"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { plantableTiles, tileCentre } from "@/components/iso-world/homeWorld"
import { IsoWorldCanvas } from "@/components/iso-world/IsoWorldCanvas"
import { isoToScreen } from "@/components/iso-world/projection"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { besideApi } from "@/services/api/beside"
import { ThemeProvider } from "@/theme/context"

import { HomeBaseScreen } from "./HomeBaseScreen"

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  // Keep this screen focused, including rerunning changed focus callbacks.
  useFocusEffect: (effect: EffectCallback) => require("react").useEffect(effect, [effect]),
}))
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: jest.requireActual("react-native").View },
  useReducedMotion: jest.fn(() => true),
  useSharedValue: (value: number) => ({ value }),
  useAnimatedStyle: (build: () => unknown) => build(),
  withTiming: (value: number) => value,
}))
jest.mock("@/components/iso-world/IsoWorldCanvas", () => ({
  IsoWorldCanvas: jest.fn(({ accessibilityLabel }: { accessibilityLabel: string }) => {
    const { View } = jest.requireActual("react-native")
    return <View testID="world-canvas" accessibilityLabel={accessibilityLabel} />
  }),
}))
jest.mock("@/components/BesideMark", () => ({ PixelArtSprite: () => null }))
jest.mock("@/components/RewardSprite", () => ({ RewardSprite: () => null }))
jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "alice" }, logout: jest.fn() }),
}))
jest.mock("@/utils/storage", () => ({ loadString: () => null, saveString: jest.fn() }))
jest.mock("@/services/api/beside", () => ({
  besideApi: {
    homebases: jest.fn(),
    state: jest.fn(),
    homebaseGarden: jest.fn(),
    plantStarterOak: jest.fn(),
    placeReward: jest.fn(),
  },
}))

const base: ApiHomebase = {
  id: "garden",
  name: "Our garden",
  memberIds: ["alice", "bob"],
  inviteCode: "unused",
}
const state: ApiState = {
  version: 3,
  users: [
    { id: "alice", name: "Alice Green", color: "moss" },
    { id: "bob", name: "Bob Brown", color: "blue" },
  ],
  connections: [{ id: base.id, name: base.name }],
  memberships: [],
  subjectTemplates: [],
  activityTemplates: [],
  subjects: [],
  activities: [],
  activitySubjects: [],
  participations: [],
  logs: [],
  logShares: [],
  contributions: [],
  events: [],
  deliveries: [],
  rewardItems: [],
  milestones: [],
  rewards: [],
}
const plantedGarden = { oak: { x: 104, y: 104, itemId: "oak-tree" as const }, rewards: [] }
const roster = "Our garden, an island garden. 2 members: Alice Green, Bob Brown."

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useReducedMotion).mockReturnValue(true)
  jest.mocked(besideApi.homebases).mockResolvedValue([base])
  jest.mocked(besideApi.state).mockResolvedValue(state)
  jest.mocked(besideApi.homebaseGarden).mockReset().mockResolvedValue({ oak: null, rewards: [] })
  jest.mocked(besideApi.plantStarterOak).mockReset().mockResolvedValue(plantedGarden)
  jest.mocked(besideApi.placeReward).mockReset()
})

function openScreen(width = 390, linked?: { rewardId: string; place?: boolean }) {
  const navigation = { navigate: jest.fn(), setParams: jest.fn() }
  const props = {
    navigation,
    route: { key: "homebase", name: "HomeBase", params: { connectionId: base.id, ...linked } },
  } as unknown as AppStackScreenProps<"HomeBase">
  const view = (connectionId = base.id, link = linked) => (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <ThemeProvider>
        <HomeBaseScreen {...props} route={{ ...props.route, params: { connectionId, ...link } }} />
      </ThemeProvider>
    </SafeAreaProvider>
  )
  const screen = render(view())
  fireEvent(screen.getByTestId("homebase-world"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 400 } },
  })
  return Object.assign(screen, {
    navigation,
    switchRoute: (connectionId: string, link?: { rewardId: string; place?: boolean }) => {
      screen.rerender(view(connectionId, link))
      fireEvent(screen.getByTestId("homebase-world"), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width, height: 400 } },
      })
    },
    layoutWorld: () =>
      fireEvent(screen.getByTestId("homebase-world"), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width, height: 400 } },
      }),
  })
}

const canvasProps = () => jest.mocked(IsoWorldCanvas).mock.calls.at(-1)![0]

it.each([390, 900])("preserves the roster and normal framing at width %i", async (width) => {
  const screen = openScreen(width)
  fireEvent.press(await screen.findByTestId("start-planting-oak"))
  expect(canvasProps().accessibilityLabel).toContain(roster)
  expect(canvasProps().accessibilityLabel).toContain("Suggest spot")
  expect(canvasProps().zoom).toBe(width >= 700 ? 3 : 2)
  fireEvent.press(screen.getByRole("button", { name: "Cancel" }))
  expect(canvasProps().accessibilityLabel).toContain(roster)
  expect(canvasProps().focus).toEqual({ u: 8.6, v: 9.3 })
})

it("keeps the losing member's 409 notice after refreshing the shared oak", async () => {
  jest
    .mocked(besideApi.homebaseGarden)
    .mockResolvedValueOnce({ oak: null, rewards: [] })
    .mockResolvedValueOnce(plantedGarden)
  jest.mocked(besideApi.plantStarterOak).mockRejectedValue(new ApiError(409, "Already planted"))
  const screen = openScreen()
  fireEvent.press(await screen.findByTestId("start-planting-oak"))
  fireEvent.press(screen.getByTestId("suggest-oak-spot"))
  fireEvent.press(screen.getByTestId("confirm-starter-oak"))
  await screen.findByTestId("homebase-starter-oak")
  expect(screen.getByText("Someone already planted the shared oak.")).toBeTruthy()
  expect(screen.queryByTestId("plant-oak-panel")).toBeNull()
  expect(screen.queryByTestId("start-planting-oak")).toBeNull()
  expect(besideApi.homebases).toHaveBeenCalledTimes(1)
  expect(besideApi.homebaseGarden).toHaveBeenCalledTimes(2)
})

it("focuses the camera on the confirmed oak and keeps zoom controls", async () => {
  const screen = openScreen()
  fireEvent.press(await screen.findByTestId("start-planting-oak"))
  fireEvent.press(screen.getByTestId("suggest-oak-spot"))
  const tile = canvasProps().previewTile!
  await act(async () => fireEvent.press(screen.getByTestId("confirm-starter-oak")))
  expect(canvasProps().focus).toEqual({ u: tile.col + 0.5, v: tile.row + 0.5 })
  expect(canvasProps().selectedKey).toBe("starter-oak")
  fireEvent.press(screen.getByTestId("homebase-zoom-in"))
  expect(canvasProps().zoom).toBe(3)
  fireEvent.press(screen.getByTestId("homebase-recenter"))
  expect(canvasProps().focus).toEqual({ u: 8.6, v: 9.3 })
})

it("offers retry and disables planting if the refresh after a 409 fails", async () => {
  jest
    .mocked(besideApi.homebaseGarden)
    .mockResolvedValueOnce({ oak: null, rewards: [] })
    .mockRejectedValueOnce(new Error("Offline"))
  jest.mocked(besideApi.plantStarterOak).mockRejectedValue(new ApiError(409, "Already planted"))
  const screen = openScreen()
  fireEvent.press(await screen.findByTestId("start-planting-oak"))
  fireEvent.press(screen.getByTestId("suggest-oak-spot"))
  fireEvent.press(screen.getByTestId("confirm-starter-oak"))
  await screen.findByText("We couldn’t load garden decorations. Please try again.")
  expect(screen.getByText("Someone already planted the shared oak.")).toBeTruthy()
  expect(screen.queryByTestId("start-planting-oak")).toBeNull()
  jest.mocked(besideApi.homebaseGarden).mockResolvedValue(plantedGarden)
  fireEvent.press(screen.getByText("Try again"))
  await screen.findByTestId("homebase-starter-oak")
})

it("clears a stale meadow and offers retry for a garden 404", async () => {
  jest
    .mocked(besideApi.homebaseGarden)
    .mockRejectedValueOnce(new ApiError(404, "Home base not found"))
  const screen = openScreen()
  await screen.findByText("This home base is no longer available. Please try again.")
  expect(screen.queryByTestId("world-canvas")).toBeNull()
  expect(screen.queryByTestId("start-planting-oak")).toBeNull()
  fireEvent.press(screen.getByText("Try again"))
  await screen.findByTestId("start-planting-oak")
  await waitFor(() => expect(screen.queryByText("Try again")).toBeNull())
})

it("waits for the garden so the first canvas already contains its saved oak", async () => {
  let resolveGarden!: (garden: typeof plantedGarden) => void
  const garden = new Promise<typeof plantedGarden>((resolve) => {
    resolveGarden = resolve
  })
  jest.mocked(besideApi.homebaseGarden).mockReturnValue(garden)
  const screen = openScreen(960)
  await waitFor(() => expect(besideApi.homebaseGarden).toHaveBeenCalledWith(base.id))
  expect(screen.getByText("Opening your island…")).toBeTruthy()
  expect(IsoWorldCanvas).not.toHaveBeenCalled()

  await act(async () => resolveGarden(plantedGarden))
  await screen.findByTestId("homebase-starter-oak")
  expect(jest.mocked(IsoWorldCanvas).mock.calls[0][0].drawables).toEqual(
    expect.arrayContaining([expect.objectContaining({ key: "starter-oak" })]),
  )
})

it("keeps the same reserved dock row when the planting button becomes a saved label", async () => {
  const screen = openScreen(960)
  const plant = await screen.findByTestId("start-planting-oak")
  const status = screen.getByTestId("homebase-garden-status")
  expect(status.props.style).toMatchObject({ minHeight: 48 })

  fireEvent.press(plant)
  fireEvent.press(screen.getByTestId("suggest-oak-spot"))
  fireEvent.press(screen.getByTestId("confirm-starter-oak"))
  await screen.findByTestId("homebase-starter-oak")

  expect(besideApi.plantStarterOak).toHaveBeenCalledWith(base.id, expect.any(Object))
  expect(screen.getByTestId("homebase-garden-status")).toBe(status)
  expect(screen.queryByTestId("start-planting-oak")).toBeNull()
})

it("offers a retry if the initial garden request fails", async () => {
  jest
    .mocked(besideApi.homebaseGarden)
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce(plantedGarden)
  const screen = openScreen()
  fireEvent.press(await screen.findByText("Try again"))
  await screen.findByTestId("homebase-starter-oak")
})

const earnedState: ApiState = {
  ...state,
  activities: [
    {
      id: "read",
      templateId: "read-book",
      creatorUserId: "alice",
      connectionId: base.id,
      name: "Book club",
      description: "",
      category: "reading",
      progressMode: "sum",
      unit: "pages",
      createdAt: "2026-11-01T00:00:00Z",
    },
  ],
  milestones: [
    {
      id: "finished",
      activityId: "read",
      parentId: "",
      kind: "achievement",
      name: "Finish Dune",
      quantity: 1,
      policy: "open",
      startAt: null,
      endAt: null,
      rewardId: "earned",
      upgradeRewardId: null,
      upgradeRequiredUserIds: [],
      upgradeCreditedAt: null,
      createdAt: "2026-11-01T00:00:00Z",
    },
  ],
  rewards: [
    {
      id: "earned",
      homebaseId: base.id,
      itemId: "sunflower",
      obtainedAt: "2026-11-18T12:00:00Z",
      requiredUserIds: ["alice", "bob"],
      upgradeCount: 4,
      buildReadyAt: null,
    },
  ],
}
const rewardPlacement = (position: { x: number; y: number }) => ({
  rewardId: "earned",
  itemId: "sunflower",
  ...position,
  placedByUserId: "alice",
  placedAt: "2026-11-19T12:00:00Z",
})

it("refreshes reward levels and construction on foreground without resetting selection or placement", async () => {
  const listeners = new Set<(state: AppStateStatus) => void>()
  const subscribe = jest.mocked(AppState.addEventListener)
  const originalSubscribe = subscribe.getMockImplementation()!
  subscribe.mockImplementation((_event, listener) => {
    listeners.add(listener)
    return {
      remove: () => {
        listeners.delete(listener)
      },
    }
  })
  const changeAppState = (state: AppStateStatus) =>
    act(async () => {
      listeners.forEach((listener) => listener(state))
    })
  const positions = plantableTiles()
  const spot = tileCentre(positions[0]!.col, positions[0]!.row)
  const saved = rewardPlacement(spot)
  jest.mocked(besideApi.state).mockResolvedValue(earnedState)
  jest.mocked(besideApi.homebaseGarden).mockResolvedValue({ oak: null, rewards: [saved] })
  const screen = openScreen(390, { rewardId: "earned" })
  try {
    await screen.findByText("Level 5 · 4 upgrades")
    fireEvent.press(screen.getByTestId("homebase-zoom-in"))
    const camera = () => {
      const { resetCamera, focus, zoom, selectedKey, previewTile } = canvasProps()
      return { resetCamera, focus, zoom, selectedKey, previewTile }
    }
    const selection = camera()
    await changeAppState("background")
    const serverTime = "2026-12-01T10:00:00.000Z"
    const buildReadyAt = "2026-12-01T10:00:30.000Z"
    jest.mocked(besideApi.state).mockResolvedValue({
      ...earnedState,
      rewards: [{ ...earnedState.rewards[0]!, upgradeCount: 5, buildReadyAt }],
    })
    jest.mocked(besideApi.homebaseGarden).mockResolvedValue({
      oak: null,
      serverTime,
      rewards: [{ ...saved, upgradeCount: 5, buildReadyAt }],
    })
    await changeAppState("active")
    await screen.findByText("Level 6 · 5 upgrades")
    expect(screen.getByText(/^Building · \d+s$/)).toBeTruthy()
    expect(camera()).toEqual(selection)

    fireEvent.press(screen.getByTestId("homebase-move-reward"))
    const placement = camera()
    expect(placement.previewTile).toBeDefined()
    await changeAppState("background")
    await changeAppState("active")
    await waitFor(() => expect(besideApi.homebaseGarden).toHaveBeenCalledTimes(3))
    expect(besideApi.homebaseGarden).toHaveBeenLastCalledWith(base.id)
    expect(besideApi.state).toHaveBeenCalledTimes(3)
    expect(besideApi.homebases).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("place-reward-panel")).toBeTruthy()
    expect(camera()).toEqual(placement)
  } finally {
    screen.unmount()
    subscribe.mockImplementation(originalSubscribe)
  }
})

it("keeps earned rewards waiting, previews on valid island lawn, confirms, remembers and moves them", async () => {
  jest.mocked(besideApi.state).mockResolvedValue(earnedState)
  jest.mocked(besideApi.homebaseGarden).mockResolvedValue(plantedGarden)
  jest.mocked(besideApi.placeReward).mockImplementation(async (_base, _reward, position) => ({
    ...plantedGarden,
    rewards: [rewardPlacement(position)],
  }))
  const screen = openScreen()
  fireEvent.press(await screen.findByTestId("homebase-place-reward"))
  expect(besideApi.placeReward).not.toHaveBeenCalled()
  const first = canvasProps().previewTile!
  const firstPoint = tileCentre(first.col, first.row)
  expect(checkMeadowPlacement(firstPoint, [plantedGarden.oak])).toBeNull()
  expect(canvasProps().drawables!.find((d) => d.key === "placement-preview")).toMatchObject({
    opacity: 0.72,
    hit: undefined,
  })
  expect(canvasProps().drawables!.some((d) => d.key === "reward-earned")).toBe(false)

  // A tap on water clears the preview and cannot submit a placement.
  const pond = canvasProps().map!.tiles.find((t) => t.kind === "water")!
  const wet = isoToScreen(canvasProps().frame!, pond.col + 0.5, pond.row + 0.5)
  act(() => canvasProps().onTap!({ ...wet }))
  expect(canvasProps().previewTile).toBeUndefined()
  fireEvent.press(screen.getByTestId("confirm-reward-placement"))
  expect(besideApi.placeReward).not.toHaveBeenCalled()
  fireEvent.press(screen.getByTestId("suggest-reward-spot"))
  await act(async () => fireEvent.press(screen.getByTestId("confirm-reward-placement")))
  expect(besideApi.placeReward).toHaveBeenCalledWith(base.id, "earned", firstPoint)
  expect(screen.getByTestId("homebase-reward-memory")).toBeTruthy()
  expect(screen.getByText("Earned for “Finish Dune” · Book club")).toBeTruthy()
  expect(screen.getByText("Level 5 · 4 upgrades")).toBeTruthy()
  expect(screen.getByText(/with Alice and Bob/)).toBeTruthy()
  expect(screen.queryByTestId("homebase-reward-waiting")).toBeNull()
  expect(canvasProps().drawables!.some((d) => d.key === "reward-earned")).toBe(true)

  // Tapping a saved prop restores its story; moving removes its old footprint.
  act(() => canvasProps().onTap!({ x: 0, y: 0 }))
  act(() =>
    canvasProps().onTap!({
      x: 0,
      y: 0,
      hit: { type: "item", id: "reward-earned", itemId: "sunflower" },
    }),
  )
  fireEvent.press(screen.getByTestId("homebase-move-reward"))
  expect(canvasProps().guideTiles).toContainEqual(first)
  expect(canvasProps().drawables!.some((d) => d.key === "reward-earned")).toBe(false)
  fireEvent.press(screen.getByTestId("suggest-reward-spot"))
  const moved = canvasProps().previewTile!
  expect(moved).not.toEqual(first)
  expect(checkMeadowPlacement(tileCentre(moved.col, moved.row), [plantedGarden.oak])).toBeNull()
  await act(async () => fireEvent.press(screen.getByTestId("confirm-reward-placement")))
  expect(besideApi.placeReward).toHaveBeenLastCalledWith(
    base.id,
    "earned",
    tileCentre(moved.col, moved.row),
  )
})

it("uses saved reward occupancy when offering oak tiles", async () => {
  const first = plantableTiles()[0]!
  const saved = rewardPlacement(tileCentre(first.col, first.row))
  jest.mocked(besideApi.state).mockResolvedValue(earnedState)
  jest.mocked(besideApi.homebaseGarden).mockResolvedValue({ oak: null, rewards: [saved] })
  const screen = openScreen()
  fireEvent.press(await screen.findByTestId("start-planting-oak"))
  expect(canvasProps().guideTiles).not.toContainEqual(first)
  const p = isoToScreen(canvasProps().frame!, first.col + 0.5, first.row + 0.5)
  act(() => canvasProps().onTap!(p))
  expect(screen.getByText("That spot is occupied.")).toBeTruthy()
  expect(canvasProps().previewTile).toBeUndefined()
})

it("follows the reward placement link and keeps activities in the Activities list", async () => {
  jest.mocked(besideApi.state).mockResolvedValue(earnedState)
  const screen = openScreen(390, { rewardId: "earned", place: true })
  await screen.findByTestId("place-reward-panel")
  expect(screen.navigation.setParams).toHaveBeenCalledWith({
    rewardId: undefined,
    place: undefined,
  })
  expect(canvasProps().previewTile).toBeDefined()
  fireEvent.press(screen.getByRole("button", { name: "Cancel" }))
  expect(canvasProps().drawables!.some((d) => d.key.startsWith("house-"))).toBe(false)
  fireEvent.press(screen.getByTestId("homebase-activities"))
  expect(screen.navigation.navigate).toHaveBeenCalledWith("Activities", { connectionId: base.id })
})

it("refreshes shared occupancy after a placement race without closing the reward editor", async () => {
  jest.mocked(besideApi.state).mockResolvedValue(earnedState)
  jest.mocked(besideApi.placeReward).mockRejectedValue(new ApiError(400, "That spot is occupied."))
  const screen = openScreen()
  fireEvent.press(await screen.findByTestId("homebase-place-reward"))
  const tile = canvasProps().previewTile!
  jest.mocked(besideApi.homebaseGarden).mockResolvedValue({
    oak: { ...tileCentre(tile.col, tile.row), itemId: "oak-tree" },
    rewards: [],
  })
  await act(async () => fireEvent.press(screen.getByTestId("confirm-reward-placement")))
  expect(screen.getByTestId("place-reward-panel")).toBeTruthy()
  expect(screen.getByText("That spot is occupied.")).toBeTruthy()
  expect(canvasProps().previewTile).toBeUndefined()
  expect(canvasProps().guideTiles).not.toContainEqual(tile)
  fireEvent.press(screen.getByTestId("suggest-reward-spot"))
  expect(canvasProps().previewTile).toBeDefined()
  expect(canvasProps().previewTile).not.toEqual(tile)
})

const secondBase: ApiHomebase = { ...base, id: "other", name: "Other island" }
const archipelagoState: ApiState = {
  ...earnedState,
  activities: [
    ...earnedState.activities,
    {
      ...earnedState.activities[0]!,
      id: "other-read",
      connectionId: secondBase.id,
      name: "Other book club",
    },
  ],
  milestones: [
    ...earnedState.milestones,
    {
      ...earnedState.milestones[0]!,
      id: "other-finished",
      activityId: "other-read",
      rewardId: "other-earned",
    },
  ],
  rewards: [
    ...earnedState.rewards,
    {
      ...earnedState.rewards[0]!,
      id: "other-earned",
      homebaseId: secondBase.id,
      itemId: "pink-tulip",
    },
  ],
}
function mockArchipelago() {
  jest.mocked(besideApi.homebases).mockResolvedValue([base, secondBase])
  jest.mocked(besideApi.state).mockResolvedValue(archipelagoState)
  jest
    .mocked(besideApi.homebaseGarden)
    .mockImplementation(async (id) => (id === base.id ? plantedGarden : { oak: null, rewards: [] }))
}

it("accepts the canvas's single-island key when selecting and planting", async () => {
  const screen = openScreen()
  fireEvent.press(await screen.findByTestId("start-planting-oak"))
  const tile = plantableTiles()[0]!
  const point = isoToScreen(canvasProps().frame!, tile.col + 0.5, tile.row + 0.5)
  act(() => canvasProps().onTap!({ ...point, islandKey: "single" }))
  expect(canvasProps().previewTile).toEqual(tile)
  await act(async () => fireEvent.press(screen.getByTestId("confirm-starter-oak")))
  expect(besideApi.plantStarterOak).toHaveBeenCalledWith(base.id, tileCentre(tile.col, tile.row))
})

it("cancels a departure preview while sailing and places only the destination's reward", async () => {
  mockArchipelago()
  jest.mocked(useReducedMotion).mockReturnValue(false)
  jest.mocked(besideApi.placeReward).mockImplementation(async (_id, rewardId, position) => ({
    oak: null,
    rewards: [{ ...rewardPlacement(position), rewardId, itemId: "pink-tulip" }],
  }))
  const screen = openScreen()
  fireEvent.press(await screen.findByTestId("homebase-place-reward"))
  expect(screen.getByTestId("place-reward-panel")).toBeTruthy()
  const departurePreview = canvasProps().previewTile!
  act(() => canvasProps().onTap!({ islandKey: secondBase.id, x: 0, y: 0 }))
  expect(canvasProps().voyage).toBeDefined()
  expect(screen.queryByTestId("place-reward-panel")).toBeNull()
  expect(canvasProps().previewTile).toBeUndefined()
  expect(
    canvasProps().islands!.every(
      (island) => !island.drawables.some((d) => d.key === "placement-preview"),
    ),
  ).toBe(true)
  fireEvent.press(screen.getByTestId("homebase-place-reward"))
  expect(besideApi.placeReward).not.toHaveBeenCalled()
  act(() => canvasProps().onArrival!())
  screen.layoutWorld()
  expect(screen.getByTestId("homebase-name").props.children).toBe(secondBase.name)
  expect(canvasProps().focusIslandKey).toBe(secondBase.id)
  expect(screen.getByText("Blush tulip is waiting")).toBeTruthy()
  expect(screen.queryByTestId("place-reward-panel")).toBeNull()
  fireEvent.press(screen.getByTestId("homebase-place-reward"))
  const tile = canvasProps().previewTile!
  expect(checkMeadowPlacement(tileCentre(tile.col, tile.row))).toBeNull()
  expect(canvasProps().guideTiles).toContainEqual(departurePreview)
  await act(async () => fireEvent.press(screen.getByTestId("confirm-reward-placement")))
  expect(besideApi.placeReward).toHaveBeenCalledWith(
    secondBase.id,
    "other-earned",
    tileCentre(tile.col, tile.row),
  )
  expect(
    canvasProps()
      .islands!.find((i) => i.key === base.id)!
      .drawables.some((d) => d.key === "reward-other-earned"),
  ).toBe(false)
})

it("uses each island's saved oak and rewards when moving a destination reward", async () => {
  mockArchipelago()
  const placedTile = plantableTiles([plantedGarden.oak])[0]!
  const saved = {
    ...rewardPlacement(tileCentre(placedTile.col, placedTile.row)),
    rewardId: "other-earned",
    itemId: "pink-tulip",
  }
  jest
    .mocked(besideApi.homebaseGarden)
    .mockImplementation(async (id) =>
      id === base.id ? { oak: null, rewards: [] } : { ...plantedGarden, rewards: [saved] },
    )
  const screen = openScreen()
  await screen.findByTestId("homebase-place-reward")
  fireEvent.press(screen.getByRole("button", { name: "Sail to Other island" }))
  screen.layoutWorld()
  expect(screen.queryByTestId("homebase-reward-waiting")).toBeNull()
  act(() =>
    canvasProps().onTap!({
      islandKey: secondBase.id,
      x: 0,
      y: 0,
      hit: { type: "item", id: "reward-other-earned", itemId: "pink-tulip" },
    }),
  )
  fireEvent.press(screen.getByTestId("homebase-move-reward"))
  expect(canvasProps().guideTiles).toContainEqual(placedTile)
  for (const tile of canvasProps().guideTiles!)
    expect(checkMeadowPlacement(tileCentre(tile.col, tile.row), [plantedGarden.oak])).toBeNull()
  expect(
    canvasProps()
      .islands!.find((i) => i.key === secondBase.id)!
      .drawables.some((d) => d.key === "reward-other-earned"),
  ).toBe(false)
})

it.each([false, true])(
  "isolates a pending reward save when a route switches islands (failure: %s)",
  async (fail) => {
    mockArchipelago()
    let resolve!: (garden: typeof plantedGarden) => void
    let reject!: (error: Error) => void
    jest.mocked(besideApi.placeReward).mockReturnValue(
      new Promise((done, failed) => {
        resolve = done
        reject = failed
      }),
    )
    const screen = openScreen()
    fireEvent.press(await screen.findByTestId("homebase-place-reward"))
    const tile = canvasProps().previewTile!
    fireEvent.press(screen.getByTestId("confirm-reward-placement"))
    expect(besideApi.placeReward).toHaveBeenCalledWith(
      base.id,
      "earned",
      tileCentre(tile.col, tile.row),
    )
    screen.switchRoute(secondBase.id)
    expect(screen.queryByTestId("place-reward-panel")).toBeNull()
    await act(async () => {
      if (fail) reject(new ApiError(400, "A is occupied"))
      else
        resolve({
          ...plantedGarden,
          rewards: [rewardPlacement(tileCentre(tile.col, tile.row))],
        } as typeof plantedGarden)
    })
    expect(screen.queryByText("A is occupied")).toBeNull()
    expect(screen.queryByText("Try again")).toBeNull()
    expect(screen.queryByTestId("homebase-reward-memory")).toBeNull()
    expect(screen.getByText("Blush tulip is waiting")).toBeTruthy()
    expect(canvasProps().focus).toEqual({ u: 8.6, v: 9.3 })
    expect(canvasProps().previewTile).toBeUndefined()
    expect(
      canvasProps()
        .islands!.find((i) => i.key === secondBase.id)!
        .drawables.some((d) => d.key === "reward-earned"),
    ).toBe(false)
    expect(besideApi.placeReward).toHaveBeenCalledTimes(1)
  },
)

it("does not publish an old oak conflict or refresh error on a newly selected island", async () => {
  mockArchipelago()
  jest.mocked(besideApi.homebaseGarden).mockResolvedValue({ oak: null, rewards: [] })
  jest.mocked(besideApi.plantStarterOak).mockRejectedValue(new ApiError(409, "Already planted"))
  const screen = openScreen()
  fireEvent.press(await screen.findByTestId("start-planting-oak"))
  fireEvent.press(screen.getByTestId("suggest-oak-spot"))
  let reject!: (error: Error) => void
  jest.mocked(besideApi.homebaseGarden).mockReturnValue(
    new Promise((_done, failed) => {
      reject = failed
    }),
  )
  await act(async () => fireEvent.press(screen.getByTestId("confirm-starter-oak")))
  expect(screen.getByText("Someone already planted the shared oak.")).toBeTruthy()
  screen.switchRoute(secondBase.id)
  await act(async () => reject(new ApiError(404, "Unavailable")))
  expect(screen.queryByText("Someone already planted the shared oak.")).toBeNull()
  expect(screen.queryByText("Try again")).toBeNull()
  expect(screen.getByTestId("start-planting-oak")).toBeTruthy()
})

it("waits for the linked reward's island before consuming a new route's placement link", async () => {
  mockArchipelago()
  const screen = openScreen()
  await screen.findByTestId("homebase-place-reward")
  screen.switchRoute(secondBase.id, { rewardId: "other-earned", place: true })
  await screen.findByTestId("place-reward-panel")
  expect(screen.getByText(/Earned for “Finish Dune” · Other book club/)).toBeTruthy()
  expect(
    screen.navigation.setParams.mock.calls.filter(([params]) => "rewardId" in params),
  ).toHaveLength(1)
  jest.mocked(besideApi.placeReward).mockImplementation(async (_baseId, rewardId, position) => ({
    oak: null,
    rewards: [{ ...rewardPlacement(position), rewardId, itemId: "pink-tulip" }],
  }))
  await act(async () => fireEvent.press(screen.getByTestId("confirm-reward-placement")))
  expect(besideApi.placeReward).toHaveBeenCalledWith(
    secondBase.id,
    "other-earned",
    expect.any(Object),
  )
})

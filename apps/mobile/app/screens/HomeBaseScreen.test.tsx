import type { EffectCallback } from "react"
import { ApiError, type ApiHomebase, type ApiState } from "@beside/api-client"
import { act, fireEvent, render, waitFor } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { oakPlantingPulseMs } from "@/components/pixel-world/starterOak"
import { WorldCanvas } from "@/components/pixel-world/WorldCanvas"
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
  useReducedMotion: () => true,
  useSharedValue: (value: number) => ({ value }),
  useAnimatedStyle: (build: () => unknown) => build(),
  withTiming: (value: number) => value,
}))
jest.mock("@/components/pixel-world/WorldCanvas", () => ({
  WorldCanvas: jest.fn(({ accessibilityLabel }: { accessibilityLabel: string }) => {
    const { View } = jest.requireActual("react-native")
    return <View testID="world-canvas" accessibilityLabel={accessibilityLabel} />
  }),
}))
jest.mock("@/components/RewardSprite", () => ({ RewardSprite: () => null }))
jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ logout: jest.fn() }) }))
jest.mock("@/services/api/beside", () => ({
  besideApi: {
    homebases: jest.fn(),
    state: jest.fn(),
    homebaseGarden: jest.fn(),
    plantStarterOak: jest.fn(),
    buyDecoration: jest.fn(),
    moveDecoration: jest.fn(),
    moveStarterOak: jest.fn(),
    returnDecoration: jest.fn(),
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
  acornEntries: [],
  decorations: [],
}
const plantedGarden = { oak: { x: 104, y: 104, itemId: "oak-tree" as const } }
const roster = "Our garden. 2 members in the meadow: Alice Green, Bob Brown."

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(besideApi.homebases).mockResolvedValue([base])
  jest.mocked(besideApi.state).mockResolvedValue(state)
  jest.mocked(besideApi.homebaseGarden).mockReset().mockResolvedValue({ oak: null })
  jest.mocked(besideApi.plantStarterOak).mockReset().mockResolvedValue(plantedGarden)
})

function openScreen(width = 390, params: { placeItemId?: string } = {}) {
  const props = {
    navigation: { navigate: jest.fn(), setParams: jest.fn() },
    route: { key: "homebase", name: "HomeBase", params: { connectionId: base.id, ...params } },
  } as unknown as AppStackScreenProps<"HomeBase">
  const screen = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <ThemeProvider>
        <HomeBaseScreen {...props} />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
  fireEvent(screen.getByTestId("homebase-world"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 400 } },
  })
  return screen
}

const canvasProps = () => jest.mocked(WorldCanvas).mock.calls.at(-1)![0]

it.each([390, 900])("preserves the roster and normal framing at width %i", async (width) => {
  const screen = openScreen(width)
  fireEvent.press(await screen.findByTestId("start-planting-oak"))
  expect(canvasProps().accessibilityLabel).toContain(roster)
  expect(canvasProps().accessibilityLabel).toContain("Suggest spot")
  expect(canvasProps().framing).toMatchObject({ scale: width < 600 ? 3 : 4 })
  fireEvent.press(screen.getByRole("button", { name: "Cancel" }))
  expect(canvasProps().accessibilityLabel).toContain(roster)
  expect(canvasProps().framing).toMatchObject({ scale: 4, centerY: 137 })
})

it("keeps the losing member's 409 notice after refreshing the shared oak", async () => {
  jest
    .mocked(besideApi.homebaseGarden)
    .mockResolvedValueOnce({ oak: null })
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

it("keeps the planting frame for the success pulse and then restores normal browsing", async () => {
  const screen = openScreen()
  fireEvent.press(await screen.findByTestId("start-planting-oak"))
  fireEvent.press(screen.getByTestId("suggest-oak-spot"))
  jest.useFakeTimers()
  try {
    await act(async () => fireEvent.press(screen.getByTestId("confirm-starter-oak")))
    expect(canvasProps().justPlanted).toBeDefined()
    expect(canvasProps().framing).toMatchObject({ scale: 3, centerY: 120 })
    act(() => jest.advanceTimersByTime(oakPlantingPulseMs))
    expect(canvasProps().justPlanted).toBeUndefined()
    expect(canvasProps().framing).toMatchObject({ scale: 4, centerY: 137 })
  } finally {
    jest.useRealTimers()
  }
})

it("offers retry and disables planting if the refresh after a 409 fails", async () => {
  jest
    .mocked(besideApi.homebaseGarden)
    .mockResolvedValueOnce({ oak: null })
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
  expect(screen.getByText("Opening your meadow…")).toBeTruthy()
  expect(WorldCanvas).not.toHaveBeenCalled()

  await act(async () => resolveGarden(plantedGarden))
  await screen.findByTestId("homebase-starter-oak")
  expect(jest.mocked(WorldCanvas).mock.calls[0][0].items).toContainEqual({
    ...plantedGarden.oak,
    key: "starter-oak",
  })
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

describe("acorn shop in the meadow", () => {
  const entry = (id: string, amount: number) => ({
    id,
    homebaseId: base.id,
    userId: "alice",
    amount,
    kind: "check-in" as const,
    milestoneId: null,
    decorationId: null,
    note: "Chapter 1",
    createdAt: "2026-11-13T10:00:00.000Z",
  })
  const pennant = {
    id: "d1",
    homebaseId: base.id,
    itemId: "rose-pennant",
    price: 50,
    purchasedByUserId: "bob",
    x: 176,
    y: 112,
    externalKey: null,
    createdAt: "2026-11-13T11:00:00.000Z",
  }
  const tap = (x: number, y: number) => act(() => canvasProps().onTap(x, y, 4))

  it("shows the shared pool and buys a shop item on the spot a member taps", async () => {
    jest
      .mocked(besideApi.state)
      .mockResolvedValue({ ...state, acornEntries: [entry("a", 20), entry("b", 12)] })
    jest.mocked(besideApi.buyDecoration).mockResolvedValue({ entityId: "d9", duplicate: false })
    const screen = openScreen(390, { placeItemId: "sunflower" })
    await screen.findByTestId("place-item-panel")
    expect(screen.getByTestId("homebase-acorns-value").props.children).toBe("32")
    expect(canvasProps().plantingGuide?.length).toBeGreaterThan(0)
    await tap(220, 146)
    expect(screen.getByText("Choose a clear patch of lawn.")).toBeTruthy()
    await tap(96, 94)
    expect(canvasProps().preview).toMatchObject({ itemId: "sunflower", x: 96, y: 96 })
    await act(async () => fireEvent.press(screen.getByTestId("place-item-confirm")))
    expect(besideApi.buyDecoration).toHaveBeenCalledWith(
      expect.objectContaining({ homebaseId: base.id, itemId: "sunflower", x: 96, y: 96 }),
    )
    expect(await screen.findByText("Sunflower is in the meadow. 22 acorns left.")).toBeTruthy()
  })

  it("moves a decoration for free, keeping clear of the starter oak, and returns it", async () => {
    jest.mocked(besideApi.state).mockResolvedValue({ ...state, decorations: [pennant] })
    jest.mocked(besideApi.homebaseGarden).mockResolvedValue(plantedGarden)
    jest.mocked(besideApi.moveDecoration).mockResolvedValue({ entityId: "d1", duplicate: false })
    jest
      .mocked(besideApi.returnDecoration)
      .mockResolvedValue({ entityId: base.id, duplicate: false })
    const screen = openScreen()
    await screen.findByTestId("homebase-starter-oak")
    await tap(176, 100)
    expect(screen.getByTestId("homebase-selected-decoration").props.children).toBe("Rose pennant")
    fireEvent.press(screen.getByTestId("homebase-move-decoration"))
    await screen.findByText("Move rose pennant")
    await tap(112, 102) // next to the oak at 104, 104
    expect(screen.getByText("Something already stands there.")).toBeTruthy()
    await tap(48, 198)
    await act(async () => fireEvent.press(screen.getByTestId("place-item-confirm")))
    expect(besideApi.moveDecoration).toHaveBeenCalledWith("d1", { x: 48, y: 200 })
    expect(await screen.findByText("Moved the rose pennant. Moving is free.")).toBeTruthy()

    await tap(176, 100)
    await act(async () => fireEvent.press(screen.getByTestId("homebase-return-decoration")))
    expect(besideApi.returnDecoration).toHaveBeenCalledWith("d1")
  })

  it("moves the starter oak", async () => {
    jest.mocked(besideApi.homebaseGarden).mockResolvedValue(plantedGarden)
    jest
      .mocked(besideApi.moveStarterOak)
      .mockResolvedValue({ oak: { x: 48, y: 200, itemId: "oak-tree" } })
    const screen = openScreen()
    await screen.findByTestId("homebase-starter-oak")
    await tap(104, 92)
    fireEvent.press(screen.getByTestId("homebase-move-oak"))
    await tap(48, 198)
    await act(async () => fireEvent.press(screen.getByTestId("place-item-confirm")))
    expect(besideApi.moveStarterOak).toHaveBeenCalledWith(base.id, { x: 48, y: 200 })
    expect(canvasProps().items).toContainEqual(expect.objectContaining({ x: 48, y: 200 }))
  })
})

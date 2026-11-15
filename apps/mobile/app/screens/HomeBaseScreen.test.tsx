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
const plantedGarden = { oak: { x: 104, y: 104, itemId: "oak-tree" as const } }
const roster = "Our garden. 2 members in the meadow: Alice Green, Bob Brown."

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(besideApi.homebases).mockResolvedValue([base])
  jest.mocked(besideApi.state).mockResolvedValue(state)
  jest.mocked(besideApi.homebaseGarden).mockReset().mockResolvedValue({ oak: null })
  jest.mocked(besideApi.plantStarterOak).mockReset().mockResolvedValue(plantedGarden)
})

function openScreen(width = 390) {
  const props = {
    navigation: { navigate: jest.fn() },
    route: { key: "homebase", name: "HomeBase", params: { connectionId: base.id } },
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

function suggestSpot(screen: ReturnType<typeof openScreen>) {
  fireEvent(screen.getByTestId("plant-oak-panel"), "layout", {
    nativeEvent: { layout: { x: 0, y: 320, width: 390, height: 80 } },
  })
  fireEvent.press(screen.getByTestId("suggest-oak-spot"))
}

const canvasProps = () => jest.mocked(WorldCanvas).mock.calls.at(-1)![0]

it.each([390, 900])("preserves the roster and normal framing at width %i", async (width) => {
  const screen = openScreen(width)
  const start = await screen.findByTestId("start-planting-oak")
  const { framing, resetCamera } = canvasProps()
  fireEvent.press(start)
  expect(canvasProps().accessibilityLabel).toContain(roster)
  expect(canvasProps().accessibilityLabel).toContain("Suggest spot")
  expect(canvasProps()).toMatchObject({ framing, resetCamera })
  fireEvent.press(screen.getByRole("button", { name: "Cancel" }))
  expect(canvasProps().accessibilityLabel).toContain(roster)
  expect(canvasProps()).toMatchObject({ framing, resetCamera })
})

it("keeps the losing member's 409 notice after refreshing the shared oak", async () => {
  jest
    .mocked(besideApi.homebaseGarden)
    .mockResolvedValueOnce({ oak: null })
    .mockResolvedValueOnce(plantedGarden)
  jest.mocked(besideApi.plantStarterOak).mockRejectedValue(new ApiError(409, "Already planted"))
  const screen = openScreen()
  fireEvent.press(await screen.findByTestId("start-planting-oak"))
  suggestSpot(screen)
  fireEvent.press(screen.getByTestId("confirm-starter-oak"))
  await screen.findByTestId("homebase-starter-oak")
  expect(screen.getByText("Someone already planted the shared oak.")).toBeTruthy()
  expect(screen.queryByTestId("plant-oak-panel")).toBeNull()
  expect(screen.queryByTestId("start-planting-oak")).toBeNull()
  expect(besideApi.homebases).toHaveBeenCalledTimes(1)
  expect(besideApi.homebaseGarden).toHaveBeenCalledTimes(2)
})

it("keeps the same framing for suggestion, save, and the success pulse", async () => {
  const screen = openScreen()
  fireEvent.press(await screen.findByTestId("start-planting-oak"))
  const { framing, resetCamera } = canvasProps()
  suggestSpot(screen)
  expect(canvasProps().preview).toBeDefined()
  expect(canvasProps()).toMatchObject({ framing, resetCamera })
  jest.useFakeTimers()
  try {
    await act(async () => fireEvent.press(screen.getByTestId("confirm-starter-oak")))
    expect(canvasProps().justPlanted).toBeDefined()
    expect(canvasProps()).toMatchObject({ framing, resetCamera })
    act(() => jest.advanceTimersByTime(oakPlantingPulseMs))
    expect(canvasProps().justPlanted).toBeUndefined()
    expect(canvasProps()).toMatchObject({ framing, resetCamera })
  } finally {
    jest.useRealTimers()
  }
})

it("only moves the camera to suggest an off-screen spot when explicitly requested", async () => {
  const screen = openScreen()
  fireEvent.press(await screen.findByTestId("start-planting-oak"))
  const { resetCamera, onCameraChange } = canvasProps()
  act(() => onCameraChange?.({ x: 0, y: 0, scale: 4 }))
  fireEvent(screen.getByTestId("plant-oak-panel"), "layout", {
    nativeEvent: { layout: { x: 0, y: 110, width: 390, height: 290 } },
  })
  fireEvent.press(screen.getByRole("button", { name: "Suggest spot" }))
  expect(screen.getByText("No clear spot in view.")).toBeTruthy()
  expect(canvasProps().preview).toBeUndefined()
  expect(canvasProps().resetCamera).toBe(resetCamera)
  fireEvent.press(screen.getByRole("button", { name: "Find another area" }))
  expect(canvasProps().preview).toBeDefined()
  expect(canvasProps().resetCamera).toBe(resetCamera + 1)
})

it("offers retry and disables planting if the refresh after a 409 fails", async () => {
  jest
    .mocked(besideApi.homebaseGarden)
    .mockResolvedValueOnce({ oak: null })
    .mockRejectedValueOnce(new Error("Offline"))
  jest.mocked(besideApi.plantStarterOak).mockRejectedValue(new ApiError(409, "Already planted"))
  const screen = openScreen()
  fireEvent.press(await screen.findByTestId("start-planting-oak"))
  suggestSpot(screen)
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
  suggestSpot(screen)
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

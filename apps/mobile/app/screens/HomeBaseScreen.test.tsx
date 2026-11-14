import { View as MockView } from "react-native"
import { ApiError, type ApiHomebase, type ApiState, type HomebaseGarden } from "@beside/api-client"
import { fireEvent, render, waitFor } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import type { WorldCanvasProps } from "@/components/pixel-world/WorldCanvas"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { besideApi } from "@/services/api/beside"
import { ThemeProvider } from "@/theme/context"

import { HomeBaseScreen } from "./HomeBaseScreen"

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) =>
    jest.requireActual("react").useEffect(effect, [effect]),
}))
jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ logout: jest.fn() }) }))
jest.mock("@/services/api/beside", () => ({
  besideApi: {
    homebases: jest.fn(),
    state: jest.fn(),
    homebaseGarden: jest.fn(),
    plantStarterOak: jest.fn(),
  },
}))
jest.mock("@/components/pixel-world/WorldCanvas", () => ({
  WorldCanvas: ({ accessibilityLabel, framing }: WorldCanvasProps) => (
    <MockView accessibilityLabel={accessibilityLabel} testID={`world-center-${framing?.centerY}`} />
  ),
}))
jest.mock("@/components/RewardSprite", () => ({ RewardSprite: () => null }))
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: jest.requireActual("react-native").View },
  useReducedMotion: () => true,
  useSharedValue: (value: number) => ({ value }),
  useAnimatedStyle: (build: () => unknown) => build(),
  withTiming: (value: number) => value,
}))

const base: ApiHomebase = {
  id: "shared",
  name: "Reading Garden",
  memberIds: ["one", "two"],
  inviteCode: "unused",
}
const state: ApiState = {
  version: 3,
  rewardItems: [],
  users: [
    { id: "one", name: "Alex Reader", color: "blue" },
    { id: "two", name: "Taylor Reed", color: "moss" },
  ],
  connections: [],
  memberships: [],
  subjectTemplates: [],
  activityTemplates: [],
  subjects: [],
  activities: [],
  activitySubjects: [],
  participations: [],
  milestones: [],
  logs: [],
  logShares: [],
  rewards: [],
  contributions: [],
  events: [],
  deliveries: [],
}
const api = jest.mocked(besideApi)

function openHome() {
  const props = {
    route: { key: "home", name: "HomeBase", params: undefined },
    navigation: {} as AppStackScreenProps<"HomeBase">["navigation"],
  } satisfies AppStackScreenProps<"HomeBase">
  const screen = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <ThemeProvider>
        <HomeBaseScreen {...props} />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
  fireEvent(screen.getByTestId("homebase-world"), "layout", {
    nativeEvent: { layout: { width: 390, height: 500 } },
  })
  return screen
}

beforeEach(() => {
  jest.resetAllMocks()
  api.homebases.mockResolvedValue([base])
  api.state.mockResolvedValue(state)
  api.homebaseGarden.mockResolvedValue({ oak: null })
})

it("announces full member names in both camera modes and restores the browse framing on cancel", async () => {
  const screen = openHome()
  const roster = "Reading Garden. 2 members in the meadow: Alex Reader, Taylor Reed."
  const plant = await screen.findByTestId("start-planting-oak")
  expect(
    screen.getByLabelText(`${roster} Drag to explore. Tap a friend to see their name.`),
  ).toBeTruthy()
  expect(screen.getByTestId("world-center-137")).toBeTruthy()
  fireEvent.press(plant)
  expect(
    screen.getByLabelText(`${roster} Tap a marked spot or use Suggest spot to preview the oak.`),
  ).toBeTruthy()
  expect(screen.getByTestId("world-center-120")).toBeTruthy()
  fireEvent.press(screen.getByRole("button", { name: "Cancel" }))
  expect(screen.getByTestId("world-center-137")).toBeTruthy()
})

it("keeps the planting conflict notice after refreshing and showing the winning oak", async () => {
  const winner: HomebaseGarden = { oak: { itemId: "oak-tree", x: 104, y: 104 } }
  api.homebaseGarden.mockResolvedValueOnce({ oak: null }).mockResolvedValueOnce(winner)
  api.plantStarterOak.mockRejectedValueOnce(new ApiError(409, "Already planted"))
  const screen = openHome()
  fireEvent.press(await screen.findByTestId("start-planting-oak"))
  fireEvent.press(screen.getByTestId("suggest-oak-spot"))
  fireEvent.press(screen.getByTestId("confirm-starter-oak"))
  expect(await screen.findByTestId("homebase-starter-oak")).toBeTruthy()
  expect(screen.getByText("Someone already planted the shared oak.")).toBeTruthy()
  expect(screen.queryByTestId("plant-oak-panel")).toBeNull()
  expect(api.homebaseGarden).toHaveBeenCalledTimes(2)
})

it("hides a stale meadow on garden 404 if membership disappeared and offers a retry", async () => {
  api.homebases.mockResolvedValueOnce([base]).mockResolvedValueOnce([])
  api.homebaseGarden.mockRejectedValueOnce(new ApiError(404, "Home base not found."))
  const screen = openHome()
  expect(await screen.findByText("This home base is no longer available.")).toBeTruthy()
  expect(screen.queryByTestId("world-center-137")).toBeNull()
  fireEvent.press(screen.getByRole("button", { name: "Try again" }))
  expect(await screen.findByTestId("start-planting-oak")).toBeTruthy()
})

it("still displays the meadow on an older API if the home base remains accessible", async () => {
  api.homebaseGarden.mockRejectedValueOnce(new ApiError(404, "Cannot GET garden"))
  const screen = openHome()
  expect(await screen.findByTestId("world-center-137")).toBeTruthy()
  await waitFor(() => expect(api.homebases).toHaveBeenCalledTimes(2))
  expect(screen.queryByTestId("start-planting-oak")).toBeNull()
  expect(screen.queryByRole("alert")).toBeNull()
})

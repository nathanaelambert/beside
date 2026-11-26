import type { EffectCallback } from "react"
import type { ApiState } from "@beside/api-client"
import { rewardItems } from "@beside/rewards"
import { fireEvent, render, waitFor } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { besideApi } from "@/services/api/beside"
import { ThemeProvider } from "@/theme/context"

import { ActivityDetailScreen } from "./ActivityDetailScreen"

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useFocusEffect: (effect: EffectCallback) => require("react").useEffect(effect, [effect]),
}))
jest.mock("@/components/iso-world/IsoWorldCanvas", () => ({ IsoWorldCanvas: () => null }))
jest.mock("@/components/MilestoneReward", () => ({
  MilestoneReward: () => null,
  RewardLanded: () => null,
}))
jest.mock("@/components/BesideMark", () => ({ PixelArtSprite: () => null }))
jest.mock("@/components/Screen", () => ({ Screen: jest.requireActual("react-native").View }))
jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "alice" } }) }))
jest.mock("@/services/api/beside", () => ({
  besideApi: {
    state: jest.fn(),
    schedules: jest.fn(),
    rewardAgreements: jest.fn(),
    homebaseGarden: jest.fn(),
    createMilestone: jest.fn(),
  },
}))

const at = "2026-11-20T10:00:00.000Z"
const snapshot: ApiState = {
  version: 3,
  serverTime: at,
  users: [
    { id: "alice", name: "Alice", color: "moss" },
    { id: "bob", name: "Bob", color: "blue" },
  ],
  connections: [{ id: "island", name: "Our island" }],
  memberships: ["alice", "bob"].map((userId) => ({ id: userId, userId, connectionId: "island" })),
  subjectTemplates: [],
  activityTemplates: [],
  subjects: [],
  activities: [
    {
      id: "reading",
      name: "Book club",
      description: "",
      connectionId: "island",
      creatorUserId: "alice",
      templateId: "read-book",
      category: "reading",
      progressMode: "sum",
      unit: "pages",
      createdAt: at,
    },
  ],
  activitySubjects: [],
  participations: ["alice", "bob"].map((userId) => ({
    id: userId,
    userId,
    activityId: "reading",
    target: 1,
    status: "active",
  })),
  milestones: [
    {
      id: "first-read",
      activityId: "reading",
      parentId: "joined",
      name: "Finish the first book",
      kind: "achievement",
      quantity: 1,
      policy: "paced",
      startAt: "2026-11-19T10:00:00.000Z",
      endAt: "2026-11-19T12:00:00.000Z",
      createdAt: at,
      rewardId: "cottage",
      upgradeRewardId: null,
      upgradeRequiredUserIds: [],
      upgradeCreditedAt: null,
    },
  ],
  rewards: [
    {
      id: "cottage",
      homebaseId: "island",
      itemId: "cozy-cottage",
      requiredUserIds: ["alice", "bob"],
      obtainedAt: "2026-11-19T11:00:00.000Z",
      upgradeCount: 0,
      buildReadyAt: null,
    },
  ],
  rewardItems,
  logs: [],
  logShares: [],
  contributions: [],
  events: [],
  deliveries: [],
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(besideApi.state).mockResolvedValue(snapshot)
  jest.mocked(besideApi.schedules).mockResolvedValue([])
  jest.mocked(besideApi.rewardAgreements).mockResolvedValue([])
  jest.mocked(besideApi.homebaseGarden).mockResolvedValue({ oak: null, rewards: [] })
  jest
    .mocked(besideApi.createMilestone)
    .mockResolvedValue({ entityId: "second-read", duplicate: false })
})

it.each([
  { itemId: null, upgradeRewardId: "cottage" },
  { itemId: "sunflower", upgradeRewardId: null },
  { itemId: null, upgradeRewardId: null },
])("plans a new milestone on a finished activity with reward choice %j", async (choice) => {
  const props = {
    route: { params: { activityId: "reading" } },
    navigation: { navigate: jest.fn(), goBack: jest.fn() },
  } as unknown as AppStackScreenProps<"ActivityDetail">
  const screen = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <ThemeProvider>
        <ActivityDetailScreen {...props} />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
  fireEvent.press(await screen.findByTestId("activity-plan-milestone"))
  expect(screen.getByTestId("plan-milestone-save")).toBeDisabled()
  fireEvent.changeText(screen.getByTestId("plan-milestone-name"), "Read the sequel")
  fireEvent.changeText(screen.getByTestId("plan-milestone-quantity"), "2")
  if (choice.upgradeRewardId) {
    fireEvent.press(screen.getByTestId("reward-choice-mode"))
    fireEvent.press(screen.getByTestId("reward-choice-mode-upgrade"))
    fireEvent.press(screen.getByTestId("reward-upgrade-option-cottage"))
  } else if (choice.itemId) {
    fireEvent.press(screen.getByTestId("reward-option-sunflower"))
  }
  fireEvent.press(screen.getByTestId("plan-milestone-save"))
  await waitFor(() => {
    expect(besideApi.createMilestone).toHaveBeenCalledTimes(1)
    expect(besideApi.createMilestone).toHaveBeenCalledWith({
      activityId: "reading",
      parentId: null,
      name: "Read the sequel",
      quantity: 2,
      policy: "open",
      startAt: null,
      endAt: null,
      ...choice,
    })
    expect(screen.queryByTestId("plan-milestone-save")).toBeNull()
    expect(besideApi.state).toHaveBeenCalledTimes(2)
  })
})

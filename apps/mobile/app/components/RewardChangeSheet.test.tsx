import { rewardItems } from "@beside/rewards"
import { fireEvent, render } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { ThemeProvider } from "@/theme/context"

import { RewardChangeSheet } from "./RewardChangeSheet"

it("can replace a planned item with an upgrade to an earned reward", () => {
  const onSave = jest.fn()
  const cottage = rewardItems.find((item) => item.id === "cozy-cottage")!
  const screen = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <ThemeProvider>
        <RewardChangeSheet
          visible
          milestoneName="Next chapter"
          items={rewardItems}
          initial="sunflower"
          initialUpgradeId={null}
          upgrades={[{ id: "island-cottage", item: cottage, detail: "Level 4 · Book club" }]}
          upgradeRosterNames={["Alice", "Bob"]}
          initialUpgradeRosterNames={[]}
          cadence={{ recurring: false, occurrences: 1, label: "one-off milestone" }}
          counts={new Map()}
          rosterNames={["Alice", "Bob"]}
          saving={false}
          onCancel={jest.fn()}
          onSave={onSave}
        />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
  fireEvent.press(screen.getByTestId("reward-choice-mode"))
  fireEvent.press(screen.getByTestId("reward-choice-mode-upgrade"))
  expect(screen.getByText("Alice and Bob must all check in to add one level.")).toBeTruthy()
  expect(screen.getByTestId("reward-change-save")).toBeDisabled()
  fireEvent.press(screen.getByRole("radio", { name: "Cozy cottage, Level 4 · Book club" }))
  fireEvent.press(screen.getByTestId("reward-change-save"))
  expect(onSave).toHaveBeenCalledWith({ itemId: null, upgradeRewardId: "island-cottage" })
})

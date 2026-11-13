import { fireEvent, render } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { ThemeProvider } from "@/theme/context"

import { PlantOakPanel } from "./PlantOakPanel"

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: jest.requireActual("react-native").View },
  useReducedMotion: () => true,
  useSharedValue: (value: number) => ({ value }),
  useAnimatedStyle: (build: () => unknown) => build(),
  withTiming: (value: number) => value,
}))
jest.mock("@/components/RewardSprite", () => ({ RewardSprite: () => null }))

it("shows both pages of decorations without making preview items plantable", () => {
  const onPlant = jest.fn()
  const metrics = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  }
  const screen = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <PlantOakPanel
          hasPreview
          saving={false}
          onCancel={jest.fn()}
          onPlant={onPlant}
          onSuggest={jest.fn()}
        />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
  expect(screen.getByText("Meadow oak")).toBeTruthy()
  expect(screen.getByText("Preview · Tap another marked spot to move it")).toBeTruthy()
  expect(screen.getByText("Free")).toBeTruthy()
  expect(screen.getAllByText("Preview")).toHaveLength(3)
  fireEvent.press(screen.getByRole("button", { name: "Next decorations" }))
  expect(screen.getByText("Blue swallowtail")).toBeTruthy()
  expect(screen.getAllByText("Preview")).toHaveLength(4)
  expect(screen.queryByRole("button", { name: "Blue swallowtail" })).toBeNull()
  expect(onPlant).not.toHaveBeenCalled()
  fireEvent.press(screen.getByRole("button", { name: "Plant oak" }))
  expect(onPlant).toHaveBeenCalledTimes(1)
})

it("does not confirm a planting until there is a valid preview", () => {
  const onPlant = jest.fn()
  const onSuggest = jest.fn()
  const screen = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <ThemeProvider>
        <PlantOakPanel
          hasPreview={false}
          saving={false}
          onCancel={jest.fn()}
          onPlant={onPlant}
          onSuggest={onSuggest}
        />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
  expect(screen.getByText("Tap a marked spot to preview the oak")).toBeTruthy()
  fireEvent.press(screen.getByRole("button", { name: "Plant oak" }))
  expect(onPlant).not.toHaveBeenCalled()
  fireEvent.press(screen.getByRole("button", { name: "Suggest spot" }))
  expect(onSuggest).toHaveBeenCalledTimes(1)
})

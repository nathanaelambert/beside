import { render } from "@testing-library/react-native"

import { WorldCanvas } from "./WorldCanvas"

jest.mock("@shopify/react-native-skia", () => ({
  AlphaType: { Premul: 0 },
  ColorType: { RGBA_8888: 0 },
  FilterMode: { Nearest: 0 },
  MipmapMode: { None: 0 },
  Skia: { Data: { fromBytes: jest.fn() }, Image: { MakeImage: jest.fn() } },
  Canvas: () => null,
}))

jest.mock("react-native-gesture-handler", () => {
  const gesture = {
    minDistance: () => gesture,
    onStart: () => gesture,
    onUpdate: () => gesture,
    onFinalize: () => gesture,
    maxDistance: () => gesture,
    onEnd: () => gesture,
  }
  return {
    Gesture: { Pan: () => gesture, Tap: () => gesture, Race: jest.fn() },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    GestureHandlerRootView: jest.requireActual("react-native").View,
  }
})

jest.mock("react-native-reanimated", () => ({
  useDerivedValue: () => ({}),
  useReducedMotion: () => true,
  useSharedValue: (value: number) => ({ value }),
}))

it("exposes the meadow description outside the Skia canvas and updates it with the mode", () => {
  const roster = "Reading Garden. 2 members in the meadow: Alex Reader, Taylor Reed."
  const browse = `${roster} Drag to explore.`
  const plant = `${roster} Use Suggest spot to preview the oak.`
  const props = {
    width: 800,
    height: 400,
    items: [],
    avatars: [],
    resetCamera: 0,
    onTap: jest.fn(),
  }
  const screen = render(<WorldCanvas {...props} accessibilityLabel={browse} />)
  expect(screen.getAllByRole("image", { name: browse })).toHaveLength(1)
  screen.rerender(<WorldCanvas {...props} accessibilityLabel={plant} />)
  expect(screen.getAllByRole("image", { name: plant })).toHaveLength(1)
  expect(screen.queryByRole("image", { name: browse })).toBeNull()
})

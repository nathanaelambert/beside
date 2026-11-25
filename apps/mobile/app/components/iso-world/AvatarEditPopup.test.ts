import { avatarEditPopupPlacement } from "./AvatarEditPopup"

jest.mock("react-native-reanimated", () => ({ __esModule: true, default: {} }))

it("opens above the avatar and keeps the pointer centered", () => {
  const placement = avatarEditPopupPlacement(150, 145, 205, 320, 280)
  expect(placement).toEqual({ visible: true, left: 84, y: 88, above: true, arrowLeft: 60 })
})

it("opens below near the top edge and stays inside the horizontal bounds", () => {
  const nearLeft = avatarEditPopupPlacement(22, 10, 60, 320, 280)
  const nearRight = avatarEditPopupPlacement(310, 10, 60, 320, 280)
  expect(nearLeft).toEqual({ visible: true, left: 8, y: 69, above: false, arrowLeft: 8 })
  expect(nearRight).toMatchObject({ visible: true, left: 180, y: 69, arrowLeft: 114 })
})

it("does not show an edit target for a sprite that has panned off screen", () => {
  expect(avatarEditPopupPlacement(-2, 20, 60, 320, 280).visible).toBe(false)
  expect(avatarEditPopupPlacement(160, -65, -15, 320, 280).visible).toBe(false)
  expect(avatarEditPopupPlacement(160, 290, 345, 320, 280).visible).toBe(false)
})

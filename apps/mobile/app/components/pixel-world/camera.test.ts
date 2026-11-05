import { cameraFrame } from "./camera"
import { getTerrain, Ground, WORLD_WIDTH } from "./terrain"

it("preserves the prototype's centered 2x camera and frames home-base avatars at 4x", () => {
  expect(cameraFrame(411, 600)).toEqual({ scale: 2, x: -82, y: 60 })
  expect(cameraFrame(411, 600, { scale: 4, centerX: 142.5, centerY: 137 })).toEqual({
    scale: 4,
    x: -364,
    y: -248,
  })
})

it("clamps camera framing at map boundaries while centering a world smaller than its viewport", () => {
  expect(cameraFrame(411, 600, { scale: 4, centerX: 0, centerY: 0 })).toEqual({
    scale: 4,
    x: 0,
    y: 0,
  })
  expect(cameraFrame(411, 600, { scale: 4, centerX: 999, centerY: 999 })).toEqual({
    scale: 4,
    x: 411 - 288 * 4,
    y: 600 - 240 * 4,
  })
  expect(cameraFrame(1000, 1000, { scale: 1, centerX: 0, centerY: 0 })).toEqual({
    scale: 1,
    x: 356,
    y: 380,
  })
})

it("gives four friends a clear larger blanket without changing the original two-person scene", () => {
  const original = getTerrain()
  const group = getTerrain("group")
  const edge = 147 * WORLD_WIDTH + 109
  expect(group.ground[edge]).toBe(Ground.Blanket)
  expect(original.ground[edge]).not.toBe(Ground.Blanket)
  const oldBasket = (139 * WORLD_WIDTH + 168) * 4
  expect(Array.from(group.rgba.slice(oldBasket, oldBasket + 4))).not.toEqual(
    Array.from(original.rgba.slice(oldBasket, oldBasket + 4)),
  )
  expect(getTerrain()).toBe(original)
  expect(getTerrain("group")).toBe(group)
})

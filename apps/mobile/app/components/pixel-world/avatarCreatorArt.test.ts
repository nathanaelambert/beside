import { avatarOptions, randomAvatarAppearance, type AvatarAppearance } from "@beside/api-client"

import { customAvatarFrames } from "./avatarCreatorArt"
import { avatarsForMembers, avatarThumbnail, memberAvatarAppearances } from "./avatars"
import { detailedAvatar } from "./detailedAvatars"

const sample: AvatarAppearance = {
  version: 1,
  skin: "bronze",
  hair: "curly",
  hairColor: "copper",
  glasses: "round",
  outfit: "moss-jacket",
}

it("draws real 48×60 animated portraits with fixed shoes and valid palette keys", () => {
  const { idle, blink, breathe } = customAvatarFrames(sample)
  for (const frame of [idle, blink, breathe]) {
    expect(frame.pixels).toHaveLength(60)
    expect(frame.pixels.every((row) => row.length === 48)).toBe(true)
    expect(frame.pixels.slice(35)).toEqual(idle.pixels.slice(35))
    expect(frame.pixels.at(-1)).toMatch(/o/)
    for (const key of new Set(frame.pixels.join("")))
      if (key !== ".") expect(frame.palette[key]).toMatch(/^#[\da-f]{6}$/i)
  }
  expect(blink.pixels).not.toEqual(idle.pixels)
  expect(breathe.pixels).not.toEqual(idle.pixels)
  expect(customAvatarFrames({ ...sample })).toBe(customAvatarFrames(sample))
})

it("treats hair, glasses, outfit shape and color ramps as independent choices", () => {
  expect(customAvatarFrames({ ...sample, hair: "bald" }).idle.pixels).not.toEqual(
    customAvatarFrames(sample).idle.pixels,
  )
  expect(customAvatarFrames({ ...sample, glasses: "square" }).idle.pixels).not.toEqual(
    customAvatarFrames(sample).idle.pixels,
  )
  const sweater = customAvatarFrames({ ...sample, outfit: "clay-sweater" }).idle
  expect(sweater.pixels.slice(32)).not.toEqual(customAvatarFrames(sample).idle.pixels.slice(32))
  const choices = randomAvatarAppearance()
  for (const part of Object.keys(avatarOptions) as (keyof typeof avatarOptions)[])
    expect(avatarOptions[part]).toContain(choices[part])
})

it("applies a custom sprite only to its membership and preserves size, timing and fallback", () => {
  const members = [
    { id: "one", name: "A member" },
    { id: "two", name: "Another member" },
  ]
  const roster = [
    { id: "member-a", connectionId: "a", userId: "one", avatarAppearance: sample },
    { id: "member-b", connectionId: "b", userId: "one" },
    { id: "member-c", connectionId: "a", userId: "two" },
  ]
  const originals = avatarsForMembers(members).map(detailedAvatar)
  const edited = avatarsForMembers(members, memberAvatarAppearances(roster, "a")).map(
    detailedAvatar,
  )
  expect(edited[0]).toEqual({ ...originals[0], frames: customAvatarFrames(sample) })
  expect(edited[1]).toEqual(originals[1])
  expect(
    avatarsForMembers(members, memberAvatarAppearances(roster, "b")).map(detailedAvatar),
  ).toEqual(originals)
})

it("fits both generations of portrait in the existing activity cards", () => {
  const original = avatarsForMembers([{ id: "a", name: "A member" }])[0]!.frames.idle
  const custom = customAvatarFrames(sample).idle
  expect(avatarThumbnail(original)).toBe(original)
  const thumb = avatarThumbnail(custom)
  expect(thumb.pixels).toHaveLength(20)
  expect(thumb.pixels.every((row) => row.length === 16)).toBe(true)
  expect(custom.pixels).toHaveLength(60)
  expect(avatarThumbnail(custom)).toBe(thumb)
})

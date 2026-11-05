import {
  avatarForMember,
  avatars,
  avatarsForMembers,
  firstNamesLabel,
  memberAvatarStyles,
} from "./avatars"
import { cameraFrame } from "./camera"
import { avatarAt } from "./scene"
import { GROUP_BLANKET, Ground, getTerrain } from "./terrain"

const members = [
  { id: "m", name: "Mosaab Emam" },
  { id: "n", name: "Nathanael Lambert" },
  { id: "v", name: "Vaibhav Kapoor" },
  { id: "p", name: "Pritesh Parmar" },
]

it("keeps the prototype's roster and maps home-base art by name, not membership order", () => {
  expect(avatars.map((avatar) => avatar.key)).toEqual(["you", "nathaniel"])
  const reordered = avatarsForMembers([members[3], members[0], members[2], members[1]])
  expect(reordered.map((avatar) => avatar.frames)).toEqual([
    memberAvatarStyles[3].frames,
    avatars[0].frames,
    memberAvatarStyles[2].frames,
    avatars[1].frames,
  ])
  expect(reordered.map((avatar) => avatar.name)).toEqual([
    members[3].name,
    members[0].name,
    members[2].name,
    members[1].name,
  ])
  expect(avatarsForMembers([{ id: "x", name: "  VAIBHAV   KAPOOR " }])[0].frames).toBe(
    memberAvatarStyles[2].frames,
  )
})

it("cycles through four arts for unknown members, preserving their identities", () => {
  const unknown = avatarsForMembers(
    Array.from({ length: 5 }, (_, i) => ({ id: String(i), name: `Friend ${i}` })),
  )
  expect(unknown[4].frames).toBe(memberAvatarStyles[0].frames)
  expect(unknown.map((avatar) => avatar.key)).toEqual(["0", "1", "2", "3", "4"])
})

it("provides valid, distinct 16 by 20 artwork with blink and breathe frames", () => {
  for (const avatar of memberAvatarStyles) {
    for (const art of Object.values(avatar.frames)) {
      expect(art.pixels).toHaveLength(20)
      expect(art.pixels.every((row) => row.length === 16)).toBe(true)
      for (const row of art.pixels)
        for (const color of row)
          if (color !== ".") expect(art.palette[color]).toMatch(/^#[a-f0-9]{6}$/i)
      expect(art.palette.o).toBe("#3b2a2e")
    }
    expect(avatar.frames.blink.pixels).not.toEqual(avatar.frames.idle.pixels)
    expect(avatar.frames.breathe.pixels).not.toEqual(avatar.frames.idle.pixels)
  }
  expect(new Set(memberAvatarStyles.map((avatar) => avatar.frames.idle.pixels.join(""))).size).toBe(
    4,
  )
})

it("spaces all four without overlapping, keeps them visible at the phone's initial camera, and selects each", () => {
  const roster = avatarsForMembers(members)
  expect(new Set(roster.map((avatar) => avatar.phase)).size).toBe(4)
  for (const [index, avatar] of roster.entries()) {
    expect(avatarAt(avatar.x, avatar.y - 10, 2, roster)?.key).toBe(avatar.key)
    const frame = cameraFrame(1080 / 2.625, 600, { scale: 4, centerX: 142.5, centerY: 137 })
    expect((avatar.x - 8) * frame.scale + frame.x).toBeGreaterThan(0)
    expect((avatar.x + 8) * frame.scale + frame.x).toBeLessThan(1080 / 2.625)
    expect(20 * frame.scale).toBe(80)
    expect(avatar.x - 8).toBeGreaterThanOrEqual(GROUP_BLANKET.x0)
    expect(avatar.x + 8).toBeLessThanOrEqual(GROUP_BLANKET.x1)
    expect(getTerrain("group").ground[avatar.y * 288 + Math.floor(avatar.x)]).toBe(Ground.Blanket)
    if (index) expect(avatar.x - roster[index - 1].x).toBe(17)
  }
})

it("formats just the members' first names for the world header", () => {
  expect(firstNamesLabel(members)).toBe("Mosaab, Nathanael, Vaibhav & Pritesh")
  expect(firstNamesLabel([])).toBe("")
  expect(firstNamesLabel([members[0]])).toBe("Mosaab")
})

it("shares exactly the same name mapping with participant rows", () => {
  for (const [index, member] of members.entries()) {
    expect(avatarForMember(member.name, index).frames).toBe(
      avatarsForMembers(members)[index].frames,
    )
  }
  expect(avatarForMember("  VAIBHAV   KAPOOR ", 0).key).toBe("vaibhav")
  expect(avatarForMember("Unknown", 4).frames).toBe(memberAvatarStyles[0].frames)
})

it("gives all four members glasses with an eye and skin visible inside each lens", () => {
  for (const [index, member] of members.entries()) {
    const art = avatarForMember(member.name, index).frames.idle
    const eyeRow = art.pixels.findIndex((row) => row.includes("e"))
    const lensRows = art.pixels.slice(eyeRow - 1, eyeRow + 3)
    expect(art.palette.g).toBeDefined()
    expect(lensRows[0]).toMatch(/gggg..gggg/)
    expect(lensRows[1]).toMatch(/g(se|es)g{4}(se|es)g/)
    expect(lensRows[3]).toMatch(/gggg..gggg/)
  }
})

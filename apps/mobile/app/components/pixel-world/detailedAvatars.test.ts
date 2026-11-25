import { AVATAR_HEIGHT, AVATAR_WIDTH, memberAvatarStyles } from "./avatars"
import { detailedAvatar } from "./detailedAvatars"

const mask = (row: string) => row.replace(/[^.]/g, "x")

it("keeps the four identities and gives each a distinct native 48×60 portrait", () => {
  const silhouettes = new Set<string>()
  for (const avatar of memberAvatarStyles) {
    const { frames, ...rest } = detailedAvatar(avatar)
    const { frames: originalFrames, ...identity } = avatar
    expect(rest).toEqual(identity)
    expect(detailedAvatar(avatar).frames).toBe(frames)
    const scale = 3
    for (const state of ["idle", "blink", "breathe"] as const) {
      const original = originalFrames[state]
      const detailed = frames[state]
      expect(detailed.pixels).toHaveLength(AVATAR_HEIGHT * scale)
      expect(detailed.pixels.every((row) => row.length === AVATAR_WIDTH * scale)).toBe(true)
      const enlargedOriginal = original.pixels.flatMap((row) =>
        Array<string>(scale).fill([...mask(row)].map((char) => char.repeat(scale)).join("")),
      )
      expect(detailed.pixels.map(mask)).not.toEqual(enlargedOriginal)
      for (const key of new Set(detailed.pixels.join("")))
        if (key !== ".") expect(detailed.palette[key]).toMatch(/^#[\da-f]{6}$/i)
    }
    expect(frames.idle.pixels).not.toEqual(frames.blink.pixels)
    expect(frames.idle.pixels).not.toEqual(frames.breathe.pixels)
    silhouettes.add(frames.idle.pixels.map(mask).join(""))
  }
  expect(silhouettes.size).toBe(4)
})

it.each(memberAvatarStyles)(
  "keeps $key's main skin and clothing colors from the login",
  (avatar) => {
    const original = avatar.frames.idle.palette
    const detailed = detailedAvatar(avatar).frames.idle.palette
    for (const tone of ["s", "S", "k", "c", "C"]) expect(detailed[tone]).toBe(original[tone])
  },
)

it("keeps Vaibhav's crown in the original skin tones without a dark rim", () => {
  const vaibhav = memberAvatarStyles.find((avatar) => avatar.key === "vaibhav")
  if (!vaibhav) throw new Error("Missing Vaibhav avatar")
  const { s, S, L } = vaibhav.frames.idle.palette
  const skinTones = new Set([s, S, L])
  for (const frame of Object.values(detailedAvatar(vaibhav).frames)) {
    const crownTop = frame.pixels.findIndex((row) => /[^.]/.test(row))
    for (const row of frame.pixels.slice(crownTop, crownTop + 10)) {
      const crown = [...row.replaceAll(".", "")]
      expect(crown.length).toBeGreaterThan(0)
      expect(crown.every((color) => skinTones.has(frame.palette[color]))).toBe(true)
    }
  }
})

it.each(memberAvatarStyles)(
  "keeps the eyes, silhouette and planted feet consistent through $key's idle cycle",
  (avatar) => {
    const { idle, blink, breathe } = detailedAvatar(avatar).frames
    // The glasses and the silhouette don't flash or shift when the eyes close.
    expect(blink.pixels.map(mask)).toEqual(idle.pixels.map(mask))
    const changedInBlink = blink.pixels.flatMap((row, y) => (row === idle.pixels[y] ? [] : [y]))
    expect(changedInBlink).toEqual([17, 18, 19])
    expect(idle.pixels.slice(33)).toEqual(blink.pixels.slice(33))
    expect(idle.pixels.slice(33)).toEqual(breathe.pixels.slice(33))
    expect(idle.pixels.at(-1)).toMatch(/[^.]/)
    expect(breathe.pixels.findIndex((row) => /[^.]/.test(row))).toBe(
      idle.pixels.findIndex((row) => /[^.]/.test(row)) + 2,
    )
  },
)

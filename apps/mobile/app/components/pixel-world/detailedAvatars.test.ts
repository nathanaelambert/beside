import { AVATAR_HEIGHT, AVATAR_WIDTH, memberAvatarStyles } from "./avatars"
import { detailedAvatar } from "./detailedAvatars"

it("details every avatar and animation frame without changing identity or the silhouette", () => {
  for (const avatar of memberAvatarStyles) {
    const { frames, ...rest } = detailedAvatar(avatar)
    const { frames: originalFrames, ...identity } = avatar
    expect(rest).toEqual(identity)
    expect(detailedAvatar(avatar).frames).toBe(frames)
    for (const state of ["idle", "blink", "breathe"] as const) {
      const original = originalFrames[state]
      const detailed = frames[state]
      expect(detailed.pixels).toHaveLength(AVATAR_HEIGHT * 2)
      expect(detailed.pixels.every((row) => row.length === AVATAR_WIDTH * 2)).toBe(true)
      expect(detailed.pixels.join("")).toMatch(/[0-7]/)
      const mask = (row: string) => row.replace(/[^.]/g, "x")
      expect(detailed.pixels.map(mask)).toEqual(
        original.pixels.flatMap((row) => {
          const doubled = mask(row).replace(/./g, "$&$&")
          return [doubled, doubled]
        }),
      )
      for (const key of new Set(detailed.pixels.join("")))
        if (key !== ".") expect(detailed.palette[key]).toMatch(/^#[\da-f]{6}$/i)
    }
    expect(frames.idle.pixels).not.toEqual(frames.blink.pixels)
    expect(frames.idle.pixels).not.toEqual(frames.breathe.pixels)
  }
})

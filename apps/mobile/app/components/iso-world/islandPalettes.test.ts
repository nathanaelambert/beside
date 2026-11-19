import { createBitmap, put } from "./bitmap"
import { assignIslandPalettes, islandPalettes, recolor } from "./islandPalettes"
import { palette } from "./paint"

describe("island palettes", () => {
  it("keeps your oldest island's original look and gives the others distinct ones", () => {
    const ids = ["oldest", "family", "climbing"]
    const assigned = assignIslandPalettes(ids)
    expect(assigned.oldest).toBe(0)
    expect(new Set(Object.values(assigned)).size).toBe(3)
    // Stable: the same base keeps its palette when it's listed again.
    expect(assignIslandPalettes(ids)).toEqual(assigned)
  })

  it("still assigns a palette when there are more islands than palettes", () => {
    const ids = Array.from({ length: islandPalettes.length + 3 }, (_, i) => `base-${i}`)
    const assigned = assignIslandPalettes(ids)
    for (const id of ids) expect(islandPalettes[assigned[id]!]).toBeDefined()
  })

  it("swaps grass and blanket colours and leaves everything else alone", () => {
    const bitmap = createBitmap(3, 1)
    put(bitmap, 0, 0, palette.grass[2]!)
    put(bitmap, 1, 0, palette.blanket[1]!)
    put(bitmap, 2, 0, "#123456")
    const harvest = recolor(bitmap, 1)
    expect(harvest).not.toBe(bitmap)
    expect([...harvest.rgba.slice(0, 3)]).not.toEqual([...bitmap.rgba.slice(0, 3)])
    expect([...harvest.rgba.slice(4, 7)]).not.toEqual([...bitmap.rgba.slice(4, 7)])
    expect([...harvest.rgba.slice(8, 12)]).toEqual([...bitmap.rgba.slice(8, 12)])
    expect(recolor(bitmap, 1)).toBe(harvest)
    expect(recolor(bitmap, 0)).toBe(bitmap)
  })
})

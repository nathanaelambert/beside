import type { PixelArt } from "@beside/rewards"

const watchFace = [
  ".....ddd.....",
  ".....dld.....",
  "....ddgdd....",
  "...dllllld...",
  "..dgfffffgd..",
  ".dgfffffffgd.",
  ".dlfffffffgd.",
  ".dlfffffffgd.",
  ".dlfffffffgd.",
  ".dgfffffffgd.",
  "..dgfffffgd..",
  "...dgggggd...",
  "....ddddd....",
  ".............",
]

// Precompute the eight pixel-art positions, clockwise from twelve o'clock.
const watchFrames: PixelArt[] = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
].map(([dx, dy]) => {
  const pixels = watchFace.map((row) => [...row])
  const length = dx && dy ? 2 : 3
  for (let step = 0; step <= length; step++) pixels[7 + step * dy]![6 + step * dx] = "h"
  return {
    format: "pixel-art",
    palette: { d: "#543b2b", g: "#d09844", l: "#f5db93", f: "#fff1d0", h: "#a42f3e" },
    pixels: pixels.map((row) => row.join("")),
  }
})

/** Use the countdown's whole seconds so every view shows the same step. */
export function pocketWatchArt(secondsRemaining: number): PixelArt {
  const size = watchFrames.length
  return watchFrames[(size - (secondsRemaining % size)) % size]!
}

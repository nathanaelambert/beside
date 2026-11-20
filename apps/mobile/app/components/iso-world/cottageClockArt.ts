import type { PixelArt } from "@beside/rewards"

export const pocketWatchArt: PixelArt = {
  format: "pixel-art",
  palette: { d: "#543b2b", g: "#d09844", l: "#f5db93", f: "#fff1d0", h: "#584938" },
  pixels: [
    ".....ddd.....",
    ".....dld.....",
    "....ddgdd....",
    "...dllllld...",
    "..dgfffffgd..",
    ".dgfffhfffgd.",
    ".dlfhfhfhfgd.",
    ".dlfhhhhhfgd.",
    ".dlfffffhfgd.",
    ".dgfffffffgd.",
    "..dgfffffgd..",
    "...dgggggd...",
    "....ddddd....",
    ".............",
  ],
}

export function cottageTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`
}

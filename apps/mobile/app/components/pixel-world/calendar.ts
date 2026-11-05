import type { PixelArt } from "@beside/rewards"

import { world } from "@/theme/world"

export const calendarArt: PixelArt = {
  format: "pixel-art",
  palette: { o: world.ink, f: world.forest, p: world.onForest, l: world.leaf },
  pixels: [
    "..o...o..",
    ".ooooooo.",
    ".offfffo.",
    ".opppppo.",
    ".oplplpo.",
    ".opppppo.",
    ".oplplpo.",
    ".ooooooo.",
    ".........",
  ],
}

import type { CottageArtSeries } from "./cottageGrowthArt"
import { terracottaSilhouettes } from "./terracottaSilhouettes"

export const terracottaArt = {
  1: {
    asset: require("@assets/images/bay-art/terracotta-small.png") as number,
    rows: terracottaSilhouettes[1],
  },
  2: {
    asset: require("@assets/images/bay-art/terracotta-wing.png") as number,
    rows: terracottaSilhouettes[2],
  },
  3: {
    asset: require("@assets/images/bay-art/terracotta-loft.png") as number,
    rows: terracottaSilhouettes[3],
  },
} satisfies CottageArtSeries

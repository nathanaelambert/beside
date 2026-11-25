import type { CottageArtSeries } from "./cottageGrowthArt"
import { terracottaSilhouettes } from "./terracottaSilhouettes"

export const terracottaArt = {
  1: {
    asset: require("@assets/images/bay-art/terracotta-small.png") as number,
    rows: terracottaSilhouettes[1],
    depthLayers: {
      front: require("@assets/images/bay-art/terracotta-depth/small-front.png") as number,
      rear: require("@assets/images/bay-art/terracotta-depth/small-rear.png") as number,
      bounds: [6, 30, 20, 62],
    },
  },
  2: {
    asset: require("@assets/images/bay-art/terracotta-wing.png") as number,
    rows: terracottaSilhouettes[2],
    depthLayers: {
      front: require("@assets/images/bay-art/terracotta-depth/wing-front.png") as number,
      rear: require("@assets/images/bay-art/terracotta-depth/wing-rear.png") as number,
      bounds: [7, 30, 21, 62],
    },
  },
  3: {
    asset: require("@assets/images/bay-art/terracotta-loft.png") as number,
    rows: terracottaSilhouettes[3],
    depthLayers: {
      front: require("@assets/images/bay-art/terracotta-depth/loft-front.png") as number,
      rear: require("@assets/images/bay-art/terracotta-depth/loft-rear.png") as number,
      bounds: [7, 30, 20, 62],
    },
  },
} satisfies CottageArtSeries

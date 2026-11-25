import { additionalCottageArt } from "./additionalCottageArt"
import type { CottageArtSeries } from "./cottageGrowthArt"
import type { RoofColor } from "./props"
import { terracottaArt } from "./terracottaArt"

/** Shared, fixed-size hero sprites for the island, workshop and activity previews. */
export const worldArtAssets = {
  cottages: {
    clay: terracottaArt,
    ...additionalCottageArt,
  } satisfies Record<RoofColor, CottageArtSeries>,
  jetty: require("@assets/images/bay-art/jetty.png") as number,
}

import type { TreeArtStage } from "./worldDetailArt"

type FlowerFrame = { asset: number; rows: readonly number[] }

// One grounded logical cell for each PNG. Rows encode alpha spans (start << 7 | end).
const flowers = {
  "sunflower": {
    sprout: {
      asset: require("../../../assets/images/flower-family/sunflower-sprout.png"),
      rows: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2324, 1430, 1302, 1301,
        1937, 1937, 1937, 1937, 0, 0,
      ],
    },
    young: {
      asset: require("../../../assets/images/flower-family/sunflower-young.png"),
      rows: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2065, 1426, 1554, 1681, 2197, 1814, 1554,
        1298, 1301, 1302, 1943, 1943, 1938, 0, 0,
      ],
    },
    mature: {
      asset: require("../../../assets/images/flower-family/sunflower-mature.png"),
      rows: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1936, 1554, 1555, 1299, 1428, 1300, 1300, 1428, 1299,
        1300, 1173, 1941, 1429, 1301, 1041, 1042, 1041, 0, 0,
      ],
    },
  },
  "pink-tulip": {
    sprout: {
      asset: require("../../../assets/images/flower-family/pink-tulip-sprout.png"),
      rows: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1684, 1684, 1684, 1811,
        1811, 1937, 1938, 0, 0,
      ],
    },
    young: {
      asset: require("../../../assets/images/flower-family/pink-tulip-young.png"),
      rows: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2065, 1938, 1810, 1941, 1429, 1556,
        1684, 1684, 1683, 1810, 1937, 1938, 0, 0,
      ],
    },
    mature: {
      asset: require("../../../assets/images/flower-family/pink-tulip-mature.png"),
      rows: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1941, 1429, 1558, 1557, 1557, 1684, 1815, 1302,
        1430, 1430, 1557, 1556, 1683, 1938, 1938, 0, 0,
      ],
    },
  },
  "lavender": {
    sprout: {
      asset: require("../../../assets/images/flower-family/lavender-sprout.png"),
      rows: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2065, 2065, 1937, 1683,
        1682, 1555, 1810, 1938, 0, 0,
      ],
    },
    young: {
      asset: require("../../../assets/images/flower-family/lavender-young.png"),
      rows: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2065, 1938, 1937, 1556, 1556, 1684, 1811,
        1557, 1684, 1811, 1557, 1810, 1938, 0, 0,
      ],
    },
    mature: {
      asset: require("../../../assets/images/flower-family/lavender-mature.png"),
      rows: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2194, 2066, 1938, 1558, 1558, 1430, 1558, 1557, 1301,
        1303, 1303, 1430, 1557, 1428, 1686, 1300, 1810, 1938, 0, 0,
      ],
    },
  },
} satisfies Record<string, Record<TreeArtStage, FlowerFrame>>

export type FlowerFamilyId = keyof typeof flowers

export function flowerFamilyArt(
  id: string,
  stage: TreeArtStage = "mature",
): FlowerFrame | undefined {
  return Object.prototype.hasOwnProperty.call(flowers, id)
    ? flowers[id as FlowerFamilyId][stage]
    : undefined
}

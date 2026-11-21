import type { TreeArtStage } from "./worldDetailArt"

type FlowerFrame = { asset: number; rows: readonly number[] }

// One grounded logical cell for each PNG. Rows encode alpha spans (start << 7 | end).
const flowers = {
  "sunflower": {
    sprout: {
      asset: require("../../../assets/images/flower-family/sunflower-sprout.png"),
      rows: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2453, 1303, 1176, 1048, 1046, 1429,
        1938, 1937, 1937, 1937, 1937, 0, 0,
      ],
    },
    young: {
      asset: require("../../../assets/images/flower-family/sunflower-young.png"),
      rows: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2065, 1426, 1298, 1427, 1426, 1686, 2200, 1816, 1684, 1427,
        1170, 1042, 1046, 1175, 1176, 1176, 1943, 1943, 1938, 0, 0,
      ],
    },
    mature: {
      asset: require("../../../assets/images/flower-family/sunflower-mature.png"),
      rows: [
        0, 0, 0, 0, 1811, 1427, 1302, 1046, 1045, 1048, 1048, 919, 920, 1048, 1046, 1045, 1299, 792,
        793, 666, 1946, 1178, 1050, 922, 922, 914, 914, 914, 1042, 1041, 0, 0,
      ],
    },
  },
  "pink-tulip": {
    sprout: {
      asset: require("../../../assets/images/flower-family/pink-tulip-sprout.png"),
      rows: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2581, 1557, 1557, 1557, 1685, 1684,
        1684, 1811, 1938, 1937, 1938, 0, 0,
      ],
    },
    young: {
      asset: require("../../../assets/images/flower-family/pink-tulip-young.png"),
      rows: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2065, 1938, 1938, 1810, 1810, 1814, 1942, 1301, 1429,
        1557, 1557, 1556, 1556, 1683, 1810, 1810, 1937, 1938, 0, 0,
      ],
    },
    mature: {
      asset: require("../../../assets/images/flower-family/pink-tulip-mature.png"),
      rows: [
        0, 0, 0, 0, 0, 0, 1939, 1430, 1302, 1431, 1431, 1558, 1558, 1557, 1557, 1688, 1816, 1047,
        1175, 1303, 1303, 1431, 1430, 1430, 1557, 1556, 1683, 1810, 1938, 1938, 0, 0,
      ],
    },
  },
  "lavender": {
    sprout: {
      asset: require("../../../assets/images/flower-family/lavender-sprout.png"),
      rows: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2065, 1937, 1937, 1556, 1555,
        1682, 1429, 1555, 1810, 1938, 0, 0,
      ],
    },
    young: {
      asset: require("../../../assets/images/flower-family/lavender-young.png"),
      rows: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2066, 1938, 1938, 1938, 1430, 1557, 1557, 1557, 1683,
        1299, 1430, 1557, 1684, 1811, 1429, 1810, 1938, 0, 0,
      ],
    },
    mature: {
      asset: require("../../../assets/images/flower-family/lavender-mature.png"),
      rows: [
        0, 0, 0, 0, 0, 0, 0, 2195, 2068, 2067, 1940, 1305, 1305, 1177, 1304, 1304, 1304, 1047, 1050,
        1050, 1049, 1304, 1558, 1173, 1304, 1560, 1301, 1555, 1810, 1938, 0, 0,
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

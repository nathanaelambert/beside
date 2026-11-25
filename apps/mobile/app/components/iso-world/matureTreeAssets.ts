import type { TreeFamilyId } from "./treeFamilyArt"
import type { TreeArtStage } from "./worldDetailArt"

/** Shared by the canvas and the selected garden item's thumbnail. */
export const matureTreeAssets = {
  "oak-tree": require("@assets/images/tree-family/oak-mature.png") as number,
  "pine-tree": require("@assets/images/tree-family/pine-mature.png") as number,
  "cherry-tree": require("@assets/images/tree-family/cherry-mature.png") as number,
} satisfies Record<TreeFamilyId, number>

const growingTreeAssets = {
  "oak-tree": {
    sprout: require("@assets/images/tree-family/oak-sprout.png") as number,
    young: require("@assets/images/tree-family/oak-young.png") as number,
  },
  "pine-tree": {
    sprout: require("@assets/images/tree-family/pine-sprout.png") as number,
    young: require("@assets/images/tree-family/pine-young.png") as number,
  },
  "cherry-tree": {
    sprout: require("@assets/images/tree-family/cherry-sprout.png") as number,
    young: require("@assets/images/tree-family/cherry-young.png") as number,
  },
} satisfies Record<TreeFamilyId, Record<Exclude<TreeArtStage, "mature">, number>>

export function treeFamilyAsset(id: TreeFamilyId, stage: TreeArtStage) {
  return stage === "mature" ? matureTreeAssets[id] : growingTreeAssets[id][stage]
}

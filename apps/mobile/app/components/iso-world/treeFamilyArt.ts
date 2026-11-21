import { growthTreeRows } from "./growthTreeRows"
import { matureTreeRows } from "./matureTreeArt"
import type { TreeArtStage } from "./worldDetailArt"

export type TreeFamilyId = keyof typeof growthTreeRows

/** The same stage and species select the same sprite, regardless of the placement owner. */
export function treeFamilyArt(itemId: string, stage: TreeArtStage = "mature") {
  if (itemId !== "oak-tree" && itemId !== "pine-tree" && itemId !== "cherry-tree") return undefined
  const rows =
    stage !== "mature"
      ? growthTreeRows[itemId][stage]
      : itemId === "cherry-tree"
        ? growthTreeRows[itemId].mature
        : matureTreeRows[itemId]
  return { id: itemId, stage, rows } as const
}

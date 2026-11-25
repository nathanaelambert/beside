import type { HomebaseGarden } from "@beside/api-client"

import { hasGrowthArt, type TreeArtStage } from "./worldDetailArt"

const youngAfterMs = 10_000
const matureAfterMs = 20_000

/** Visual only: snapshots without a planting date predate growth and stay fully grown. */
export function plantArtStage(startedAt: string | undefined, now: number): TreeArtStage {
  const start = Date.parse(startedAt ?? "")
  if (!Number.isFinite(start) || now >= start + matureAfterMs) return "mature"
  return now >= start + youngAfterMs ? "young" : "sprout"
}

/** Last upcoming maturity boundary, so the shared visual clock can idle for settled gardens. */
export function gardenGrowthDeadline(gardens: Iterable<HomebaseGarden | undefined>) {
  let deadline = 0
  for (const garden of gardens) {
    if (!garden) continue
    for (const plant of [garden.oak, ...garden.rewards]) {
      if (!plant || !hasGrowthArt(plant.itemId)) continue
      const start = Date.parse(plant.growthStartedAt ?? "")
      if (Number.isFinite(start)) deadline = Math.max(deadline, start + matureAfterMs)
    }
  }
  return deadline
}

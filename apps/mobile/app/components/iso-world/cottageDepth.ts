import { createBitmap } from "./bitmap"
import type { CottageDepthLayers } from "./cottageGrowthArt"
import type { Drawable } from "./scene"

const transparentReturn = createBitmap(1, 1)

function intersectsFacade(
  cottage: Drawable,
  bounds: CottageDepthLayers["bounds"],
  other: Drawable,
) {
  const [l, t, r, b] = bounds
  const left = cottage.x + l - other.x
  const right = cottage.x + r - other.x
  const top = cottage.y + t - other.y
  const bottom = cottage.y + b - other.y
  if (right <= 0 || left >= other.width || bottom <= 0 || top >= other.height) return false
  if (!other.artRows) return true
  // Spans sample logical pixel centers; allow for native texels between them.
  for (let y = Math.max(0, top - 1); y < Math.min(other.height, bottom + 1); y++) {
    const span = other.artRows[y] ?? 0
    if (span && (span >> 7) - 1 < right && (span & 127) + 1 > left) return true
  }
  return false
}

export function cottageLayers(
  cottage: Drawable,
  layers: CottageDepthLayers | undefined,
  facades: readonly Drawable[] = [],
): Drawable[] {
  if (!layers) return [cottage]
  const blockers = facades.filter(
    (other) =>
      (other.depth < cottage.depth ||
        (other.depth === cottage.depth && other.baseX < cottage.baseX)) &&
      intersectsFacade(cottage, layers.bounds, other),
  )
  // Terracotta has a full texture; split it only when an earlier facade could be covered.
  if (layers.front !== undefined && blockers.length === 0) return [cottage]
  return [
    {
      key: `${cottage.key}-rear`,
      source: { type: "bitmap", bitmap: transparentReturn },
      artAsset: layers.rear,
      depth: Math.min(cottage.depth, ...blockers.map((other) => other.depth)) - 0.01,
      x: cottage.x,
      y: cottage.y,
      width: cottage.width,
      height: cottage.height,
      baseX: cottage.baseX,
      baseY: cottage.baseY,
      top: cottage.top,
    },
    layers.front === undefined ? cottage : { ...cottage, artAsset: layers.front },
  ]
}

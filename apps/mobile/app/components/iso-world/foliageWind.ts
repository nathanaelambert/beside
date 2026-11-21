export type FoliageKind = "tree" | "shrub" | "flower"

/** Each gust has a long rest and a short lean in either direction, in whole pixels. */
export function foliageGust(tick: number, phase: number) {
  "worklet"
  const beat = Math.floor((tick + phase) / 3) % 12
  if (beat === 2 || beat === 3) return -1
  if (beat === 7 || beat === 8) return 1
  return 0
}

/** Nearby props ease into a breeze at different times, without random changes on re-render. */
export function foliagePhase(baseX: number, baseY: number) {
  return (Math.abs(baseX * 7 + baseY * 11) % 36) | 0
}

/** Preserve the trunk or stem and the contact pixels, even for the smallest sprout. */
export function foliageBands(
  { y, height, top, baseY }: { y: number; height: number; top: number; baseY: number },
  kind: FoliageKind,
) {
  const visible = Math.max(0, baseY - top)
  const held =
    kind === "tree"
      ? Math.max(5, Math.round(visible * 0.36))
      : Math.max(3, Math.round(visible * 0.45))
  const root = Math.max(y, Math.min(y + height, baseY - held))
  const canopy = kind === "tree" && visible >= 18 ? Math.round((top + root) / 2) : root
  return {
    canopy: Math.max(y, Math.min(canopy, root)),
    root,
    tipTravel: kind === "tree" && visible >= 18 ? 2 : 1,
  }
}

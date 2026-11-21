import { cottageStage } from "./cottageGrowthArt"
import { roofColorOrder } from "./props"
import { buildActivityScene, buildHomeScene, type Drawable } from "./scene"
import { worldArtAssets } from "./worldArtAssets"

const { cottages } = worldArtAssets

const placement = ({ x, y, baseX, baseY, width, height, depth }: Drawable) => ({
  x,
  y,
  baseX,
  baseY,
  width,
  height,
  depth,
})

it.each(roofColorOrder)(
  "%s gains an annex and a loft around the same grounded front step",
  (roof) => {
    const images = ([1, 2, 3] as const).map((level) => cottages[roof][level])
    expect(cottageStage(roof, 0, cottages)).toBe(images[0])
    const spans = images.map(({ rows }) => {
      expect(rows).toHaveLength(70)
      expect(rows.slice(67)).toEqual([0, 0, 0])
      expect(rows[66]! >> 7).toBeLessThanOrEqual(27)
      expect(rows[66]! & 127).toBeGreaterThan(27)
      return {
        area: rows.reduce((sum, span) => sum + (span & 127) - (span >> 7), 0),
        end: Math.max(...rows.map((span) => span & 127)),
        top: rows.findIndex(Boolean),
      }
    })
    expect(spans[1]!.end).toBeGreaterThan(spans[0]!.end)
    expect(spans[1]!.area).toBeGreaterThan(spans[0]!.area)
    expect(spans[2]!.area).toBeGreaterThan(spans[1]!.area)
    expect(spans[2]!.top).toBeLessThan(spans[1]!.top)
  },
)

it("keeps the established lot and art family at the 0, 1, 2 and 3 milestone boundaries", () => {
  const levels = [1, 2, 2, 3] as const
  const plans = levels.map((_, cottageMilestones) =>
    buildHomeScene({
      avatars: [],
      items: [],
      activities: roofColorOrder.map((roof) => ({
        id: roof,
        name: roof,
        cottageMilestones,
      })),
      assets: worldArtAssets,
    }),
  )
  for (const roof of roofColorOrder) {
    const houses = plans.map((plan) => plan.drawables.find((d) => d.key === `house-${roof}`))
    expect(houses.map((d) => placement(d!))).toEqual(Array(4).fill(placement(houses[0]!)))
    expect(houses.map((d) => d?.artRows)).toEqual(levels.map((level) => cottages[roof][level].rows))
    const activity = buildActivityScene({ roof, lit: true, level: 3, attendees: [], cottages })
    expect(activity.drawables.find((d) => d.key === "house-plot")?.artRows).toBe(
      cottages[roof][3].rows,
    )
  }
})

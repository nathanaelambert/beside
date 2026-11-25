import { cottageLayers } from "./cottageDepth"
import { cottageStage } from "./cottageGrowthArt"
import { roofColorOrder } from "./props"
import { buildActivityScene, buildHomeScene, opaqueAt, type Drawable } from "./scene"
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
  const footing = plans[0]!.drawables.find(
    (drawable) => drawable.key === "house-moss",
  )?.contactShadow
  expect(footing).toBeTruthy()
  for (const roof of roofColorOrder) {
    const houses = plans.map((plan) => plan.drawables.find((d) => d.key === `house-${roof}`))
    expect(houses.map((d) => placement(d!))).toEqual(Array(4).fill(placement(houses[0]!)))
    expect(houses.map((d) => d?.artRows)).toEqual(levels.map((level) => cottages[roof][level].rows))
    const activity = buildActivityScene({ roof, lit: true, level: 3, attendees: [], cottages })
    const plot = activity.drawables.find((d) => d.key === "house-plot")!
    expect(plot.artRows).toBe(cottages[roof][3].rows)
    expect(plot.contactShadow).toBe(footing)
    for (const house of houses) {
      expect(house?.contactShadow).toBe(footing)
      // The painted ground contact adds no opaque hit pixels below the step.
      expect(opaqueAt(house!, house!.x + 29, house!.y + 68)).toBe(false)
    }
  }
})

it.each([0, 1, 3])("puts only Terracotta's rear behind neighboring Plum at %i milestones", (n) => {
  const activities = Array.from({ length: 5 }, (_, i) => ({
    id: String(i),
    name: String(i),
    cottageMilestones: n,
  }))
  const clay = cottages.clay
  const { asset, rows, depthLayers } = clay[n === 0 ? 1 : n === 1 ? 2 : 3]
  expect(depthLayers).toBeDefined()
  const { drawables } = buildHomeScene({
    avatars: [],
    items: [],
    activities,
    assets: worldArtAssets,
  })
  const { drawables: original } = buildHomeScene({
    avatars: [],
    items: [],
    activities,
    assets: {
      cottages: {
        ...cottages,
        clay: {
          1: { asset: clay[1].asset, rows: clay[1].rows },
          2: { asset: clay[2].asset, rows: clay[2].rows },
          3: { asset: clay[3].asset, rows: clay[3].rows },
        },
      },
    },
  })
  const rear = drawables.find((d) => d.key === "house-0-rear")!
  const front = drawables.find((d) => d.key === "house-0")!
  const plum = drawables.find((d) => d.key === "house-2")!
  expect(rear.artAsset).toBe(depthLayers?.rear)
  expect(front.artAsset).toBe(depthLayers?.front)
  expect(front.artRows).toBe(rows)
  expect(drawables.indexOf(rear)).toBeLessThan(drawables.indexOf(plum))
  expect(drawables.indexOf(plum)).toBeLessThan(drawables.indexOf(front))
  expect(placement(rear)).toEqual({ ...placement(front), depth: rear.depth })
  expect(rear.hit).toBeUndefined()
  expect(rear.contactShadow).toBeUndefined()
  expect(
    drawables.filter((d) => d !== rear).map((d) => (d === front ? { ...d, artAsset: asset } : d)),
  ).toEqual(original)
})

it("uses the full Terracotta texture without Plum and in the activity plot", () => {
  const home = buildHomeScene({
    avatars: [],
    items: [],
    activities: [{ id: "solo", name: "Terracotta", cottageMilestones: 3 }],
    assets: worldArtAssets,
  })
  expect(home.drawables.find((d) => d.key === "house-solo")?.artAsset).toBe(cottages.clay[3].asset)
  expect(home.drawables.find((d) => d.key === "house-solo-rear")).toBeUndefined()
  const plot = buildActivityScene({ roof: "clay", lit: true, level: 3, attendees: [], cottages })
  expect(plot.drawables.find((d) => d.key === "house-plot")?.artAsset).toBe(cottages.clay[3].asset)
})

it.each(["teal", "plum", "moss", "slate"] as const)(
  "%s keeps the approved facade and selection while drawing a rear in all three stages",
  (roof) => {
    for (const level of [1, 2, 3] as const) {
      const image = cottages[roof][level]
      const plot = buildActivityScene({ roof, lit: true, level, attendees: [], cottages })
      const front = plot.drawables.find((d) => d.key === "house-plot")!
      const rear = plot.drawables.find((d) => d.key === "house-plot-rear")!
      expect(front.artAsset).toBe(image.asset)
      expect(front.artRows).toBe(image.rows)
      expect(rear.artAsset).toBe(image.depthLayers?.rear)
      expect(plot.drawables.indexOf(rear)).toBeLessThan(plot.drawables.indexOf(front))
      expect(placement(rear)).toEqual({ ...placement(front), depth: rear.depth })
      expect(rear.hit).toBeUndefined()
      expect(rear.contactShadow).toBeUndefined()
    }
  },
)

it("puts a rear behind every intersecting earlier facade without moving the main drawable", () => {
  const plot = buildActivityScene({ roof: "teal", lit: true, level: 3, attendees: [], cottages })
  const cottage = plot.drawables.find((d) => d.key === "house-plot")!
  const neighbors = [
    { ...cottage, x: cottage.x - 26, artRows: undefined, depth: cottage.depth - 1 },
    { ...cottage, x: cottage.x - 20, artRows: undefined, depth: cottage.depth - 2 },
    { ...cottage, x: cottage.x + 60, artRows: undefined, depth: cottage.depth - 5 },
  ]
  const [rear, front] = cottageLayers(cottage, cottages.teal[3].depthLayers, neighbors)
  expect(rear?.depth).toBeCloseTo(cottage.depth - 2.01)
  expect(front).toBe(cottage)
})

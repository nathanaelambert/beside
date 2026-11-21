import { cottageStage, type CottageArtSeries } from "./cottageGrowthArt"
import { buildActivityScene, buildHomeScene, opaqueAt } from "./scene"
import { terracottaSilhouettes } from "./terracottaSilhouettes"

const art: CottageArtSeries = {
  1: { asset: 41, rows: terracottaSilhouettes[1] },
  2: { asset: 42, rows: terracottaSilhouettes[2] },
  3: { asset: 43, rows: terracottaSilhouettes[3] },
}
const cottages = { clay: art }

it("adds width for the wing and height for the loft without shifting the front step", () => {
  const sizes = [art[1], art[2], art[3]].map(({ rows }) => {
    expect(rows).toHaveLength(70)
    expect(rows.slice(67)).toEqual([0, 0, 0])
    const foot = rows[66]!
    expect(foot >> 7).toBeLessThanOrEqual(27)
    expect(foot & 127).toBeGreaterThan(27)
    return rows.reduce((area, span) => area + (span & 127) - (span >> 7), 0)
  })
  expect(sizes[1]).toBeGreaterThan(sizes[0]!)
  expect(sizes[2]).toBeGreaterThan(sizes[1]!)
  expect(art[3].rows.findIndex(Boolean)).toBeLessThan(art[2].rows.findIndex(Boolean))
})

it("shares the same enlargement sequence between the main island and activity", () => {
  const home = ([0, 1, 2, 3] as const).map((level) =>
    buildHomeScene({
      avatars: [],
      items: [],
      activities: [
        {
          id: "a",
          name: "A cottage",
          construction:
            level === 0
              ? { level, building: 1, seconds: 5 }
              : { level, building: null, seconds: 0 },
        },
      ],
      assets: { cottages },
    }),
  )
  const houses = home.map((scene) => scene.drawables.find((d) => d.key === "house-a")!)
  const anchors = houses.map(({ x, y, baseX, baseY, width, height, depth }) => [
    x,
    y,
    baseX,
    baseY,
    width,
    height,
    depth,
  ])
  expect(anchors).toEqual(Array(4).fill(anchors[0]))
  expect(houses.map((d) => d.artAsset)).toEqual([41, 41, 42, 43])
  expect(home[0]?.drawables.some((d) => d.key === "house-a-clock")).toBe(true)
  expect(home[1]?.drawables.some((d) => d.key === "house-a-clock")).toBe(false)
  const loft = houses[3]!
  expect(opaqueAt(loft, loft.x + 32, loft.y + 22)).toBe(false)
  expect(opaqueAt(loft, loft.x + 34, loft.y + 22)).toBe(true)
  const plot = buildActivityScene({
    roof: "clay",
    lit: false,
    level: 3,
    attendees: [],
    cottages,
  })
  expect(plot.drawables.find((d) => d.key === "house-plot")?.artAsset).toBe(loft.artAsset)
  expect(cottageStage("teal", 3, cottages)).toBeUndefined()
})

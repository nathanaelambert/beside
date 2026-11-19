import { initialMeadowItems } from "@beside/api-client/garden"

import {
  archipelagoBounds,
  archipelagoLayout,
  focusedIslandLayers,
  hitTestIslands,
  islandPoint,
  onIsland,
  seaProps,
  signScale,
  snapZoom,
  stepZoom,
  zoomStops,
  type IslandLayer,
} from "./archipelago"
import { islandVariantSeed, MOORING, SEA_LIFT } from "./archipelagoProps"
import { buildHomeScene, homeFrame } from "./scene"
import { meadowTileMap } from "./tilemap"
import { voyagePath, voyagePoint } from "./voyage"
import { avatarsForMembers } from "../pixel-world/avatars"

function layers(ids = ["project", "family", "friends"]): IslandLayer[] {
  const offsets = archipelagoLayout(ids)
  return ids.map((key) => ({
    key,
    map: meadowTileMap(),
    frame: homeFrame,
    drawables: [],
    offset: offsets[key]!,
  }))
}

describe("archipelago layout", () => {
  it("handles no islands and preserves the single island origin", () => {
    expect(archipelagoLayout([])).toEqual({})
    expect(archipelagoLayout(["one"])).toEqual({ one: { x: 0, y: 0 } })
  })
  it("keeps input order, deterministic jitter, water gaps, and alternating columns", () => {
    const ids = Array.from({ length: 30 }, (_, i) => `base-${i}`)
    const offsets = archipelagoLayout(ids)
    expect(Object.keys(offsets)).toEqual(ids)
    expect(archipelagoLayout(ids)).toEqual(offsets)
    ids.slice(1).forEach((id, i) => {
      const previous = offsets[ids[i]!]!
      const current = offsets[id]!
      const gap = current.y - previous.y - homeFrame.height
      expect(gap).toBeGreaterThanOrEqual(80)
      expect(gap).toBeLessThanOrEqual(140)
      expect(Math.sign(current.x - previous.x)).toBe((i + 1) % 2 ? 1 : -1)
    })
    const world = layers(ids)
    for (const [i, a] of world.entries())
      for (const b of world.slice(i + 1)) {
        expect(a.offset.y + a.frame.height).toBeLessThan(b.offset.y)
      }
  })
  it("includes every island and panning margin in its bounds", () => {
    const world = layers()
    const bounds = archipelagoBounds(world)
    world.forEach((island) => {
      expect(island.offset.x).toBeGreaterThanOrEqual(bounds.x + 64)
      expect(island.offset.y + island.frame.height).toBeLessThanOrEqual(
        bounds.y + bounds.height - 64,
      )
    })
  })
})

describe("island hit testing", () => {
  const world = layers()
  const scene = buildHomeScene({
    avatars: avatarsForMembers([{ id: "sam", name: "Sam" }]),
    items: [],
  })
  world[1]!.drawables = scene.drawables
  const avatar = scene.drawables.find((d) => d.key === "avatar-sam")!
  it("maps sea coordinates to the correct island's local hit target", () => {
    const offset = world[1]!.offset
    expect(
      hitTestIslands(world, { x: offset.x + avatar.baseX, y: offset.y + avatar.baseY - 8 }, 22),
    ).toEqual({
      islandKey: "family",
      x: avatar.baseX,
      y: avatar.baseY - 8,
      hit: { type: "avatar", id: "sam" },
    })
    expect(hitTestIslands(world, islandPoint(world[0]!, 5, 5), 22).islandKey).toBe("project")
    expect(hitTestIslands(world, { x: 50, y: 400 }, 22).islandKey).toBeUndefined()
  })
  it("accepts signs only at the zoom levels where they are shown", () => {
    world[2]!.sign = { ...avatar, x: 180, y: -40, width: 90, height: 20, baseX: 225, baseY: -20 }
    const point = { x: world[2]!.offset.x + 190, y: world[2]!.offset.y - 30 }
    expect(hitTestIslands(world, point, 22, true).islandKey).toBe("friends")
    expect(hitTestIslands(world, point, 22, false).islandKey).toBeUndefined()
    const enlarged = { x: world[2]!.offset.x + 120, y: world[2]!.offset.y - 60 }
    expect(hitTestIslands(world, enlarged, 22, true, 3).islandKey).toBe("friends")
    expect(hitTestIslands(world, enlarged, 22, true).islandKey).toBeUndefined()
  })
})

describe("crisp zoom", () => {
  it.each([1, 2, 2.625, 3, 3.5])("steps integer device pixels at density %s", (ratio) => {
    const stops = zoomStops(ratio, true)
    // Every density can zoom out to a third of a point, where the archipelago fits on a phone.
    expect(stops[0]).toBeLessThanOrEqual(1 / 3 + 0.001)
    // At or above one device pixel per art pixel, every stop is a whole number of them.
    for (const zoom of stops.filter((z) => z * ratio >= 1))
      expect(zoom * ratio).toBeCloseTo(Math.round(zoom * ratio))
    for (let i = 0; i < stops.length - 1; i++) {
      expect(stepZoom(stops[i]!, 1, stops)).toBe(stops[i + 1])
      expect(stepZoom(stops[i + 1]!, -1, stops)).toBe(stops[i])
    }
    expect(stepZoom(stops[0]!, -1, stops)).toBe(stops[0])
    expect(stepZoom(stops[stops.length - 1]!, 1, stops)).toBe(stops[stops.length - 1])
    expect(stops).toContain(snapZoom(2, stops))
    expect(zoomStops(ratio, false)[0]).toBeGreaterThanOrEqual(1)
  })
})

describe("voyages", () => {
  const world = layers(Array.from({ length: 5 }, (_, i) => `voyage-${i}`))
  it("starts and ends at moorings, never crossing land even past intermediate islands", () => {
    for (const from of world)
      for (const to of world.filter((island) => island !== from)) {
        const path = voyagePath(from, to, world, MOORING)
        const round = (point: { x: number; y: number }) => ({
          x: Math.round(point.x),
          y: Math.round(point.y),
        })
        expect(voyagePoint(path, 0)).toEqual(
          round(islandPoint(from, MOORING.u, MOORING.v, SEA_LIFT)),
        )
        expect(voyagePoint(path, 1)).toEqual(round(islandPoint(to, MOORING.u, MOORING.v, SEA_LIFT)))
        for (let i = 0; i <= 1000; i++) {
          const point = voyagePoint(path, i / 1000)
          expect(world.some((island) => onIsland(island, point))).toBe(false)
          expect(Number.isInteger(point.x) && Number.isInteger(point.y)).toBe(true)
        }
      }
    // Moorings rest below the lawn, on the ocean plane.
    expect(SEA_LIFT).toBe(-14)
  })
  it("bends around an island that blocks a direct crossing", () => {
    const path = voyagePath(world[0]!, world[4]!, world, MOORING)
    expect(path.points.length).toBeGreaterThan(100)
    const start = path.points[0]!
    const end = path.points[path.points.length - 1]!
    expect(
      path.points.some(
        (p) =>
          Math.abs((p.x - start.x) * (end.y - start.y) - (p.y - start.y) * (end.x - start.x)) > 100,
      ),
    ).toBe(true)
  })
})

it("varies terrain props without changing the shared meadow or planting rules", () => {
  const build = (id: string) =>
    buildHomeScene({ avatars: [], items: initialMeadowItems, variantSeed: islandVariantSeed(id) })
  const a = build("family")
  const b = build("friends")
  expect(a.map).toBe(b.map)
  const positions = (scene: ReturnType<typeof build>) =>
    scene.drawables
      .filter((d) => d.key.startsWith("prop-"))
      .map((d) => [d.key, d.x, d.y, d.source.type === "art" ? d.source.art : undefined])
  expect(positions(a)).not.toEqual(positions(b))
  expect(positions(a)).toEqual(positions(build("family")))
})

it("shows the signed-in avatar only on the focused blanket, and only on the boat during travel", () => {
  const world = layers()
  const scene = buildHomeScene({
    avatars: avatarsForMembers([
      { id: "you", name: "Mosaab" },
      { id: "sam", name: "Sam" },
    ]),
    items: [],
  })
  world.forEach((island) => {
    island.drawables = scene.drawables
  })
  const present = (world: IslandLayer[]) =>
    world
      .filter((layer) => layer.drawables.some((d) => d.key === "avatar-you"))
      .map((layer) => layer.key)
  expect(present(focusedIslandLayers(world, "family", "you", false))).toEqual(["family"])
  expect(present(focusedIslandLayers(world, "family", "you", true))).toEqual([])
  expect(
    focusedIslandLayers(world, "family", "you", true).every((layer) =>
      layer.drawables.some((d) => d.key === "avatar-sam"),
    ),
  ).toBe(true)
})

describe("sea props and signs", () => {
  it("keeps open-water props off every island", () => {
    const world = layers(["a", "b", "c", "d"])
    const props = seaProps(world)
    expect(props).toHaveLength(9)
    for (const prop of props)
      for (const island of world) expect(onIsland(island, prop, 0.6)).toBe(false)
  })

  it("draws signs at a readable size on every density", () => {
    for (const ratio of [1, 2, 3]) expect(signScale(ratio)).toBeGreaterThanOrEqual(1.3)
    expect(signScale(3) * 3).toBe(Math.round(signScale(3) * 3))
  })
})

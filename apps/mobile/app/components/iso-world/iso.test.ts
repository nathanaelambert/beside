import { cottageLevel, type ApiState } from "@beside/api-client"
import {
  checkMeadowPlacement,
  checkStarterOakPlacement,
  initialMeadowItems,
} from "@beside/api-client/garden"

import { bitmapToPixelArt } from "./bitmap"
import { cottageArt } from "./cottageArt"
import { homeActivities, plantableTiles, plantingTap, tileCentre } from "./homeWorld"
import { paintGround } from "./paint"
import { isoToScreen, mapFrame, screenToIso } from "./projection"
import { house, roofColorOrder, type RoofColor } from "./props"
import {
  buildActivityScene,
  buildHomeScene,
  hitTest,
  homeFrame,
  HOUSE_LOTS,
  opaqueAt,
} from "./scene"
import { meadowTileMap, tileAt } from "./tilemap"
import { avatarsForMembers } from "../pixel-world/avatars"

const members = [
  { id: "m1", name: "Mosaab" },
  { id: "m2", name: "Nathanael Lambert" },
  { id: "m3", name: "Vaibhav Kapoor" },
  { id: "m4", name: "Pritesh Parmar" },
]

describe("projection", () => {
  it("round-trips tile space through screen space at any lift", () => {
    const frame = mapFrame(18, 15)
    for (const [u, v, lift] of [
      [0, 0, 0],
      [3.25, 7.5, 0],
      [17.9, 14.1, 8],
      [9, 2, -3],
    ] as const) {
      const p = isoToScreen(frame, u, v, lift)
      const back = screenToIso(frame, p.x, p.y, lift)
      expect(back.u).toBeCloseTo(u)
      expect(back.v).toBeCloseTo(v)
    }
  })

  it("lays tiles out as 32 × 16 diamonds", () => {
    const frame = mapFrame(2, 2)
    const a = isoToScreen(frame, 0, 0)
    expect(isoToScreen(frame, 1, 0)).toEqual({ x: a.x + 16, y: a.y + 8 })
    expect(isoToScreen(frame, 0, 1)).toEqual({ x: a.x - 16, y: a.y + 8 })
  })
})

describe("meadow tile map", () => {
  const map = meadowTileMap()

  it("samples the 288 × 240 meadow into an 18 × 15 island ringed by forest", () => {
    expect(map.cols).toBe(18)
    expect(map.rows).toBe(15)
    for (let col = 0; col < map.cols; col++) expect(tileAt(map, col, 0)?.kind).toBe("forest")
    const kinds = new Set(map.tiles.map((tile) => tile.kind))
    for (const kind of ["grass", "water", "blanket", "dock", "path", "sand"])
      expect(kinds).toContain(kind)
  })

  it("only offers grass tiles for the starter oak, using the API's own rule", () => {
    expect(plantableTiles().length).toBeGreaterThan(20)
    for (const { col, row } of plantableTiles()) {
      expect(tileAt(map, col, row)?.kind).toBe("grass")
      expect(checkStarterOakPlacement(tileCentre(col, row))).toBeNull()
    }
  })

  it("keeps cottage lots off land anyone could plant on", () => {
    for (const [col, row] of HOUSE_LOTS)
      expect(checkStarterOakPlacement(tileCentre(col, row))).not.toBeNull()
  })

  it("keeps cottages clear of the meadow's decorations", () => {
    for (const [col, row] of HOUSE_LOTS.slice(0, 5))
      for (const item of initialMeadowItems) {
        const near =
          Math.abs(item.x / 16 - (col + 0.5)) < 0.7 && Math.abs(item.y / 16 - (row + 0.5)) < 0.7
        expect(near).toBe(false)
      }
  })
})

describe("painting", () => {
  it("covers the whole island ground without gaps", () => {
    const map = meadowTileMap()
    const ground = paintGround(map, homeFrame)
    // Every grass tile centre is opaque.
    for (const tile of map.tiles.filter((t) => t.lift === 0)) {
      const p = isoToScreen(homeFrame, tile.col + 0.5, tile.row + 0.5)
      const i = (Math.floor(p.y) * ground.width + Math.floor(p.x)) * 4
      expect(ground.rgba[i + 3]).toBe(255)
    }
  })

  it.each(roofColorOrder)(
    "keeps the %s cottage wide and anchored with either window state",
    (roof) => {
      const unlit = house(roof, false, 3)
      const lit = house(roof, true, 3)
      const pixels = Array.from(unlit.bitmap.rgba).filter((_, i) => i % 4 === 3)
      const litPixels = Array.from(lit.bitmap.rgba).filter((_, i) => i % 4 === 3)
      const points = pixels.flatMap((alpha, i) => (alpha ? [i % unlit.bitmap.width] : []))

      expect([unlit.anchorX, unlit.anchorY]).toEqual([32, 60])
      expect([lit.anchorX, lit.anchorY]).toEqual([unlit.anchorX, unlit.anchorY])
      expect(litPixels).toEqual(pixels)
      expect(lit.bitmap.rgba).not.toEqual(unlit.bitmap.rgba)
      expect(Math.max(...points) - Math.min(...points) + 1).toBeGreaterThan(30)
    },
  )

  it("distinguishes the clubhouse pennant and the timber lodge from the porch design", () => {
    const hasColor = (roof: RoofColor, color: string) =>
      Object.values(bitmapToPixelArt(house(roof, false, 3).bitmap).palette).includes(color)

    expect(hasColor("slate", "#f1bc53")).toBe(true)
    expect(hasColor("clay", "#f1bc53")).toBe(false)
    expect(hasColor("teal", "#ce9156")).toBe(true)
    expect(hasColor("clay", "#ce9156")).toBe(false)
  })

  it("uses the same unlock thresholds and distinct art in the map and thumbnails", () => {
    expect([0, 1, 2, 3].map(cottageLevel)).toEqual([1, 2, 2, 3])
    for (const index of [0, 1, 4]) {
      const arts = ([1, 2, 3] as const).map((level) => cottageArt(index, false, level))
      expect(new Set(arts.map((art) => JSON.stringify(art))).size).toBe(3)
    }
    const art = (cottageMilestones: number) =>
      buildHomeScene({
        avatars: [],
        items: [],
        activities: [{ id: "a", name: "Build", cottageMilestones }],
      }).drawables.find((drawable) => drawable.key === "house-a")!
    expect(art(0).source).not.toEqual(art(1).source)
    expect(art(2).source).toEqual(art(1).source)
    expect(art(3).source).not.toEqual(art(1).source)
    expect([art(0).baseX, art(0).baseY]).toEqual([art(3).baseX, art(3).baseY])
  })

  it("shows the construction watch without changing the cottage hit target", () => {
    const plot = buildActivityScene({
      roof: "clay",
      lit: false,
      level: 0,
      building: true,
      attendees: [],
    })
    const cottage = plot.drawables.find((drawable) => drawable.key === "house-plot")!
    const clock = plot.drawables.find((drawable) => drawable.key === "house-plot-clock")
    expect(clock?.source.type).toBe("art")
    expect(clock?.hit).toBeUndefined()
    expect(hitTest(plot.drawables, cottage.baseX, cottage.baseY - 3, 16)).toEqual({
      type: "house",
      id: "plot",
    })
    expect(
      buildActivityScene({ roof: "clay", lit: false, level: 1, attendees: [] }).drawables.some(
        (drawable) => drawable.key === "house-plot-clock",
      ),
    ).toBe(false)
  })

  it("converts generated sprites to shared pixel art", () => {
    const sprite = house("teal", true)
    const art = bitmapToPixelArt(sprite.bitmap)
    expect(art.pixels).toHaveLength(sprite.bitmap.height)
    expect(art.pixels[0]).toHaveLength(sprite.bitmap.width)
    expect(Object.keys(art.palette).length).toBeGreaterThan(5)
  })
})

describe("home scene", () => {
  const avatars = avatarsForMembers(members)
  const scene = buildHomeScene({
    avatars,
    items: [...initialMeadowItems, { key: "reward-r1", itemId: "sunflower", x: 104, y: 104 }],
    activities: [
      { id: "a1", name: "Read together", open: true },
      { id: "a2", name: "Walk" },
    ],
  })

  it("places one cottage per activity and draws back to front", () => {
    expect(scene.houses.map((h) => h.activity.id)).toEqual(["a1", "a2"])
    const depths = scene.drawables.map((d) => d.depth)
    expect(depths).toEqual([...depths].sort((a, b) => a - b))
    expect(scene.drawables.some((d) => d.key === "reward-r1")).toBe(true)
  })

  it("hit-tests friends and cottages, front-most first", () => {
    for (const avatar of avatars) {
      const d = scene.drawables.find((x) => x.key === `avatar-${avatar.key}`)!
      expect(hitTest(scene.drawables, d.baseX, d.baseY - 8, 22)).toEqual({
        type: "avatar",
        id: avatar.key,
      })
    }
    const cottage = scene.drawables.find((x) => x.key === "house-a1")!
    expect(hitTest(scene.drawables, cottage.baseX, cottage.baseY - 20, 22)).toEqual({
      type: "house",
      id: "a1",
    })
  })

  it("never hides a friend behind a cottage", () => {
    const friends = scene.drawables.filter((d) => d.source.type === "avatar")
    const cottages = scene.drawables.filter((d) => d.key.startsWith("house-"))
    for (const f of friends)
      for (const c of cottages) {
        const overlapX = f.x < c.x + c.width - 16 && f.x + f.width > c.x + 16
        const overlapY = f.y < c.baseY && f.baseY > c.top
        expect(overlapX && overlapY && c.depth > f.depth).toBe(false)
      }
  })

  it("keeps cottages and friends selectable with all five roof colors in the picnic area", () => {
    const busy = buildHomeScene({
      avatars,
      items: [],
      activities: roofColorOrder.map((roof) => ({ id: roof, name: roof, cottageMilestones: 3 })),
    })
    for (const drawable of busy.drawables.filter((d) => d.hit?.type === "house")) {
      const visible = [-9, -4, 0, 4, 9].some((dx) =>
        [14, 20, 26, 32, 38].some((dy) => {
          const x = drawable.baseX + dx
          const y = drawable.baseY - dy
          return opaqueAt(drawable, x, y) && hitTest(busy.drawables, x, y, 0) === drawable.hit
        }),
      )
      expect(visible).toBe(true)
    }
    for (const avatar of avatars) {
      const friend = busy.drawables.find((d) => d.key === `avatar-${avatar.key}`)!
      expect(hitTest(busy.drawables, friend.baseX, friend.baseY - 8, 22)).toEqual({
        type: "avatar",
        id: avatar.key,
      })
    }
  })

  it("maps a planting tap to the centre of the tapped tile", () => {
    const target = plantableTiles()[0]!
    const p = isoToScreen(homeFrame, target.col + 0.8, target.row + 0.3)
    const tap = plantingTap(homeFrame, p.x, p.y)
    expect(tap).toMatchObject({ col: target.col, row: target.row, rejection: null })
    expect(tap.point).toEqual(tileCentre(target.col, target.row))
    const pond = meadowTileMap().tiles.find((t) => t.kind === "water")!
    const wet = isoToScreen(homeFrame, pond.col + 0.5, pond.row + 0.5)
    expect(plantingTap(homeFrame, wet.x, wet.y).rejection).toBe("terrain")
  })

  it("draws who checked in outside the activity's cottage", () => {
    const plot = buildActivityScene({ roof: "clay", lit: true, attendees: avatars.slice(0, 2) })
    expect(plot.drawables.filter((d) => d.source.type === "avatar")).toHaveLength(2)
    expect(plot.drawables.some((d) => d.key === "house-plot")).toBe(true)
  })
})

describe("home data", () => {
  const state = {
    activities: [
      { id: "b", connectionId: "h1", name: "Later", createdAt: "2026-11-02T00:00:00Z" },
      { id: "a", connectionId: "h1", name: "Earlier", createdAt: "2026-11-01T00:00:00Z" },
      { id: "x", connectionId: "h2", name: "Elsewhere", createdAt: "2026-10-01T00:00:00Z" },
    ],
    milestones: [
      {
        id: "m",
        activityId: "b",
        kind: "achievement",
        startAt: "2026-11-13T10:00:00Z",
        endAt: "2026-11-13T20:00:00Z",
      },
    ],
    rewards: [
      { id: "r2", homebaseId: "h1", itemId: "owl-statue", obtainedAt: "2026-11-05T00:00:00Z" },
      { id: "r1", homebaseId: "h1", itemId: "sunflower", obtainedAt: "2026-11-04T00:00:00Z" },
      { id: "r0", homebaseId: "h1", itemId: "star-statue", obtainedAt: null },
    ],
  } as unknown as ApiState

  it("keeps cottages in creation order and lights the ones open now", () => {
    expect(homeActivities(state, "h1", Date.parse("2026-11-13T12:00:00Z"))).toEqual([
      { id: "a", name: "Earlier", open: false },
      { id: "b", name: "Later", open: true },
    ])
  })
})

describe("shared island placement", () => {
  it("uses the same occupancy for tile taps, suggestions and API validation", () => {
    const first = plantableTiles()[0]!
    const occupied = [tileCentre(first.col, first.row)]
    expect(plantableTiles(occupied)).not.toContainEqual(first)
    const p = isoToScreen(homeFrame, first.col + 0.5, first.row + 0.5)
    expect(plantingTap(homeFrame, p.x, p.y, occupied).rejection).toBe("occupied")
    for (const { col, row } of plantableTiles(occupied)) {
      const at = tileCentre(col, row)
      expect(checkMeadowPlacement(at, occupied)).toBeNull()
      expect(tileAt(meadowTileMap(), col, row)?.kind).toBe("grass")
    }
  })

  it("keeps legacy 8-pixel anchors exact and renders more than eight saved rewards", () => {
    const items = Array.from({ length: 10 }, (_, index) => ({
      key: `reward-${index}`,
      itemId: "sunflower",
      x: 80 + index * 8,
      y: 104,
    }))
    const scene = buildHomeScene({ avatars: [], items })
    expect(scene.drawables.filter((d) => d.key.startsWith("reward-"))).toHaveLength(10)
    for (const item of items) {
      const d = scene.drawables.find((d) => d.key === item.key)!
      const expected = isoToScreen(scene.frame, item.x / 16, item.y / 16)
      expect(d.baseX).toBe(Math.round(expected.x))
      expect(d.baseY).toBe(Math.round(expected.y))
    }
  })
})

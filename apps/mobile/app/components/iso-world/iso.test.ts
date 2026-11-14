import type { ApiState } from "@beside/api-client"
import { checkStarterOakPlacement, initialMeadowItems } from "@beside/api-client/garden"

import { bitmapToPixelArt } from "./bitmap"
import { homeActivities, homeRewards, plantableTiles, plantingTap, tileCentre } from "./homeWorld"
import { paintGround } from "./paint"
import { isoToScreen, mapFrame, screenToIso } from "./projection"
import { house } from "./props"
import {
  buildActivityScene,
  buildHomeScene,
  hitTest,
  homeFrame,
  HOUSE_LOTS,
  REWARD_LOTS,
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

  it("keeps cottage and reward lots off land anyone could plant on", () => {
    for (const [col, row] of [...HOUSE_LOTS, ...REWARD_LOTS])
      expect(checkStarterOakPlacement(tileCentre(col, row))).not.toBeNull()
    for (const [col, row] of REWARD_LOTS) expect(tileAt(map, col, row)?.kind).toBe("forest")
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
    items: initialMeadowItems,
    rewards: [{ id: "r1", itemId: "sunflower" }],
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

  it("shows only decorations the home base has earned", () => {
    expect(homeRewards(state, "h1").map((r) => r.id)).toEqual(["r1", "r2"])
  })
})

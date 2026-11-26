import {
  checkMeadowPlacement,
  checkStarterOakPlacement,
  initialMeadowItems,
} from "@beside/api-client/garden"

import { bitmapToPixelArt } from "./bitmap"
import { plantableTiles, plantingTap, tileCentre } from "./homeWorld"
import { paintGround } from "./paint"
import { isoToScreen, mapFrame, screenToIso } from "./projection"
import { house } from "./props"
import { isConstructionVisible } from "./rewardClockArt"
import { buildGatheringScene, buildHomeScene, hitTest, homeFrame } from "./scene"
import { meadowTileMap, tileAt } from "./tilemap"
import { avatarsForMembers } from "../pixel-world/avatars"

it("keeps construction visible when the reward or its watch intersects the viewport", () => {
  const reward = { x: 100, y: 100, width: 32, height: 32 }
  const watch = { x: 110, y: 90, width: 13, height: 14 }
  const view = { left: 90, top: 110, right: 140, bottom: 145 }
  expect(isConstructionVisible(view, reward, watch)).toBe(true)
  expect(isConstructionVisible({ ...view, top: 80, bottom: 95 }, reward, watch)).toBe(true)
  expect(isConstructionVisible({ ...view, top: 132, bottom: 145 }, reward, watch)).toBe(false)
})

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
    items: [...initialMeadowItems, { key: "reward-r1", itemId: "sunflower", x: 104, y: 104 }],
  })

  it("draws saved rewards back to front without activity buildings", () => {
    expect(scene.drawables.some((d) => d.key.startsWith("house-"))).toBe(false)
    const depths = scene.drawables.map((d) => d.depth)
    expect(depths).toEqual([...depths].sort((a, b) => a - b))
    expect(scene.drawables.some((d) => d.key === "reward-r1")).toBe(true)
  })

  it("hit-tests friends and earned objects, front-most first", () => {
    for (const avatar of avatars) {
      const d = scene.drawables.find((x) => x.key === `avatar-${avatar.key}`)!
      expect(hitTest(scene.drawables, d.baseX, d.baseY - 8, 22)).toEqual({
        type: "avatar",
        id: avatar.key,
      })
    }
    const reward = scene.drawables.find((x) => x.key === "reward-r1")!
    expect(hitTest(scene.drawables, reward.baseX, reward.baseY - 3, 22)).toEqual({
      type: "item",
      id: "reward-r1",
      itemId: "sunflower",
    })
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

  it("shows friends checking in and keeps the decorative cottage in the auth scene", () => {
    const plot = buildGatheringScene(avatars.slice(0, 2))
    expect(plot.drawables.filter((d) => d.source.type === "avatar")).toHaveLength(2)
    expect(plot.drawables.some((d) => d.key === "decorative-cottage")).toBe(false)
    expect(
      buildGatheringScene(avatars, true).drawables.some((d) => d.key === "decorative-cottage"),
    ).toBe(true)
  })

  it("renders a placed cottage and changes its look at higher levels without moving its anchor", () => {
    const item = { key: "reward-cottage", itemId: "cozy-cottage", x: 104, y: 104 }
    const sceneAt = (upgradeCount: number) =>
      buildHomeScene({ avatars: [], items: [{ ...item, upgradeCount }] }).drawables.find(
        (d) => d.key === item.key,
      )!
    const base = sceneAt(0)
    const upgraded = sceneAt(4)
    expect(upgraded.source).not.toEqual(base.source)
    expect(upgraded.source).not.toEqual(sceneAt(3).source)
    expect(upgraded).toMatchObject({ baseX: base.baseX, baseY: base.baseY, hit: base.hit })
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

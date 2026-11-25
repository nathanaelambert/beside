import { homeExpansionCandidates } from "@beside/api-client/homebase-expansion"

import { coastHeight, coastRimV, coastStair, walkSurfaceLift } from "./coastAccess"
import { homeCoastTerrain } from "./homeExpansion"
import { tileCentre } from "./homeWorld"
import { lawnWalk, meadowCell } from "./lawnWalk"
import { CELL, isoToScreen, mapFrame } from "./projection"
import { meadowTileMap, tileAt, tileMapFromRows } from "./tilemap"

it("routes across the picnic and around water and blocked cells", () => {
  const map = tileMapFromRows(["ggggg", "gbwpg", "ggggg"])
  const frame = mapFrame(map.cols, map.rows)
  const start = { x: 20, y: 25 }
  const tap = isoToScreen(frame, 4.6, 1.4)
  const walk = lawnWalk(map, frame, start, tap, [{ col: 2, row: 0 }])
  expect(walk?.cell).toEqual({ col: 4, row: 1 })
  expect(walk?.route[0]).toBe(start)
  expect(walk?.route.slice(2).map(meadowCell)).toEqual([
    { col: 1, row: 2 },
    { col: 2, row: 2 },
    { col: 3, row: 2 },
    { col: 4, row: 2 },
    { col: 4, row: 1 },
  ])
})

it("reaches every individual saved coastal cell and returns without crossing props or unsaved sea", () => {
  const base = meadowTileMap()
  const frame = mapFrame(base.cols, base.rows)
  const start = tileCentre(7, 7)
  const meadowTap = isoToScreen(frame, 7.5, 7.5)
  for (const tile of homeExpansionCandidates([])) {
    const map = homeCoastTerrain(base, [tile])
    const target = isoToScreen(frame, tile.col + 0.5, tile.row + 0.5, coastHeight)
    const walk = lawnWalk(map, frame, start, target, [{ col: 9, row: 13 }])!
    const back = lawnWalk(map, frame, walk.route.at(-1)!, meadowTap, [{ col: 9, row: 13 }])!
    expect(walk).toMatchObject({ cell: tile, lift: coastHeight })
    expect(back.route.at(-1)).toEqual(start)
    expect(lawnWalk(base, frame, start, target, [])).toBeUndefined()
    expect(lawnWalk(map, frame, start, target, [coastStair])).toBeUndefined()
    for (const direction of [walk.route, back.route]) {
      let lift = walkSurfaceLift(map, direction[0]!.x / CELL, direction[0]!.y / CELL)
      const heights = new Set<number>()
      for (let i = 1; i < direction.length; i++) {
        const a = direction[i - 1]!
        const b = direction[i]!
        for (let n = 0; n <= 100; n++) {
          const u = (a.x + ((b.x - a.x) * n) / 100) / CELL
          const v = (a.y + ((b.y - a.y) * n) / 100) / CELL
          const ground = tileAt(map, Math.floor(u), Math.floor(v))
          expect(ground).toBeDefined()
          if (v >= map.rows) expect(Math.floor(u)).toBe(tile.col)
          // Foreground shrubs/rocks are at 0.5 ± 0.15; pass outside their 0.3-cell footprint.
          if (ground?.kind === "forest")
            expect(v - (map.rows - 1) >= 0.95 || u - coastStair.col >= 0.95).toBe(true)
          const current = walkSurfaceLift(map, u, v)
          expect(Math.abs(current - lift)).toBeLessThan(0.3)
          if (current > 0 && current < coastHeight) heights.add(current)
          lift = current
        }
      }
      expect(heights.size).toBeGreaterThan(20)
    }
  }
})

it("crosses adjacent saved cells directly but detours along the original rim for an unsaved gap", () => {
  const base = meadowTileMap()
  const frame = mapFrame(base.cols, base.rows)
  const [first, second, , fourth] = homeExpansionCandidates([])
  const map = homeCoastTerrain(base, [first!, second!, fourth!])
  const start = tileCentre(first!.col, first!.row)
  const tap = (col: number) => isoToScreen(frame, col + 0.5, map.rows + 0.5, coastHeight)
  expect(lawnWalk(map, frame, start, tap(second!.col), [])?.route).toEqual([
    start,
    tileCentre(second!.col, second!.row),
  ])
  expect(lawnWalk(map, frame, start, tap(13), [])).toBeUndefined()
  const gap = homeCoastTerrain(base, [first!, fourth!])
  const detour = lawnWalk(gap, frame, start, tap(fourth!.col), [])
  expect(detour?.route.slice(1, -1).every((p) => p.y === coastRimV * CELL)).toBe(true)
})

it("does not offer movement to water, isolated lawn, occupied lawn or the current cell", () => {
  const map = tileMapFromRows(["g..g", "fwwg", "g..g"])
  const frame = mapFrame(map.cols, map.rows)
  for (const [col, row] of [
    [0, 0],
    [1, 1],
    [3, 0],
  ]) {
    expect(
      lawnWalk(map, frame, tileCentre(0, 0), isoToScreen(frame, col! + 0.5, row! + 0.5), []),
    ).toBeUndefined()
  }
  const open = tileMapFromRows(["gg"])
  const openFrame = mapFrame(2, 1)
  expect(
    lawnWalk(open, openFrame, tileCentre(0, 0), isoToScreen(openFrame, 1.5, 0.5), [
      { col: 1, row: 0 },
    ]),
  ).toBeUndefined()
})

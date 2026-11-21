import { rewardItems, type PixelArt } from "@beside/rewards"

import { buoy, islandSign, jetty, rowboat, seaRock } from "./archipelagoProps"
import { type Bitmap } from "./bitmap"
import { paintBlock, paintGround, seaTile } from "./paint"
import { mapFrame } from "./projection"
import { bush, rock } from "./props"
import { tileAt, tileMapFromRows, type CoastMaterial } from "./tilemap"
import {
  detailedCatalogArt,
  detailedRewardArt,
  detailedSpriteBitmap,
  hasGrowthArt,
  isTreeArt,
  treeArtStages,
  type DetailedSpriteKind,
} from "./worldDetailArt"

const artMask = ({ pixels }: PixelArt) =>
  pixels.map((row) => Array.from(row.slice(0, pixels[0]!.length), (c) => (c === "." ? 0 : 1)))
const alpha = ({ rgba }: Bitmap) => rgba.filter((_, i) => i % 4 === 3)
const occupiedRows = (art: PixelArt) =>
  art.pixels.flatMap((row, y) => (row.includes(".") && /^\.+$/.test(row) ? [] : [y]))

it("has distinct detailed art for each of the twelve current catalog props", () => {
  expect(rewardItems).toHaveLength(12)
  for (const { id, artifact } of rewardItems) {
    const detailed = detailedCatalogArt(id)!
    expect(detailed).not.toEqual(artifact)
    expect(detailed.pixels).toHaveLength(32)
    expect(detailed.pixels.every((row) => row.length === 32)).toBe(true)
    expect(artMask(detailed)).toEqual(artMask(artifact))
    expect(detailedRewardArt(artifact)).toBe(detailed)
    expect(detailedCatalogArt(id)).toBe(detailed)
  }
  expect(detailedCatalogArt("missing")).toBeUndefined()
})

it("keeps the same ground row for all stages of each tree and flower", () => {
  const plants = rewardItems.filter(({ id }) => hasGrowthArt(id))
  expect(plants.filter(({ id }) => isTreeArt(id))).toHaveLength(3)
  expect(plants).toHaveLength(6)
  for (const { id } of plants) {
    const growth = treeArtStages.map((stage) => {
      const art = detailedCatalogArt(id, stage)!
      const rows = occupiedRows(art)
      expect(art.pixels).toHaveLength(32)
      expect(art.pixels.every((row) => row.length === 32)).toBe(true)
      expect(rows.at(-1)).toBe(29)
      return rows[0]!
    })
    expect(growth[0]).toBeGreaterThan(growth[1]!)
    expect(growth[1]).toBeGreaterThan(growth[2]!)
  }
  expect(detailedCatalogArt("stone-lantern", "sprout")).toBe(detailedCatalogArt("stone-lantern"))
})

it("keeps anchors and alpha for generated props including both frames of sea objects", () => {
  const props = [
    ["nature", bush(0.8)],
    ["nature", rock(0.4)],
    ["boat", rowboat(0)],
    ["boat", rowboat(1)],
    ["buoy", buoy(0)],
    ["buoy", buoy(1)],
    ["sea-rock", seaRock(0.69)],
    ["sign", islandSign("The bay")],
    ["jetty", jetty()],
  ] satisfies [DetailedSpriteKind, ReturnType<typeof bush>][]
  for (const [kind, sprite] of props) {
    const original = sprite.bitmap.rgba.slice()
    const detailed = detailedSpriteBitmap(sprite.bitmap, kind)
    expect(detailed.width).toBe(sprite.bitmap.width)
    expect(detailed.height).toBe(sprite.bitmap.height)
    expect(alpha(detailed)).toEqual(alpha(sprite.bitmap))
    expect(detailed.rgba).not.toEqual(original)
    expect(sprite.bitmap.rgba).toEqual(original)
    expect(detailedSpriteBitmap(sprite.bitmap, kind)).toBe(detailed)
  }
})

it.each<CoastMaterial>(["sandstone", "granite", "slate"])(
  "paints %s material without changing the coast silhouette or raised tiles",
  (coast) => {
    const base = { ...tileMapFromRows([".ffff..", ".ggbb..", ".gwpgd.", "..ssg.."]), coast }
    const detailed = { ...base, art: "detailed" as const }
    const frame = mapFrame(base.cols, base.rows)
    const src = paintGround(base, frame)
    const result = paintGround(detailed, frame)
    expect(alpha(result)).toEqual(alpha(src))
    expect(result.rgba).not.toEqual(src.rgba)
    const forest = tileAt(base, 1, 0)!
    const block = paintBlock(base, frame, forest)
    const detailedBlock = paintBlock(detailed, frame, forest)
    expect({ ...detailedBlock, bitmap: block.bitmap }).toEqual(block)
    expect(alpha(detailedBlock.bitmap)).toEqual(alpha(block.bitmap))
    expect(detailedBlock.bitmap.rgba).not.toEqual(block.bitmap.rgba)
    expect(detailed.tiles).toBe(base.tiles)
  },
)

it("keeps sea texture geometry (and the original texture) while using a separate art cache", () => {
  const original = seaTile()
  const detailed = seaTile(true)
  expect(seaTile(false)).toBe(original)
  expect(seaTile(true)).toBe(detailed)
  expect(detailed.width).toBe(original.width)
  expect(detailed.height).toBe(original.height)
  expect(alpha(detailed)).toEqual(alpha(original))
  expect(detailed.rgba).not.toEqual(original.rgba)
})

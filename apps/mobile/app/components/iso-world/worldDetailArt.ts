import { rewardItems, type PixelArt } from "@beside/rewards"

import { bitmapToPixelArt, createBitmap, hash, isSet, noise, put, type Bitmap } from "./bitmap"
import { harborLamp } from "./harborArt"
import { readingBenchArt } from "./picnicArt"
import { fillPolygon, type Point } from "./props"

export const treeArtStages = ["sprout", "young", "mature"] as const
export type TreeArtStage = (typeof treeArtStages)[number]

// Material ramps are ordered from shadow to highlight. The catalog's source art
// supplies the silhouette and light direction; local clusters add material cues.
const ramps = {
  oak: ["#243d2b", "#39543a", "#546e3d", "#78934a", "#a1b959", "#d4d98a"],
  pine: ["#223938", "#304c40", "#42634b", "#59805a", "#85a865", "#c2cd84"],
  blossom: ["#593544", "#853b50", "#aa5064", "#c9737d", "#e69a9a", "#f6baa9", "#ffe0c0"],
  wood: ["#372925", "#584032", "#7f5337", "#ad7548", "#deb07a"],
  stem: ["#263e32", "#3c5b3b", "#567542", "#7c9c4f", "#bacb71"],
  brass: ["#613726", "#945125", "#b97834", "#db9d46", "#efd06e", "#fff1ac", "#fffae0"],
  stone: ["#364344", "#4d5b58", "#66746b", "#8b9480", "#b5b49a", "#dbd4b7"],
  limestone: ["#4a4536", "#645543", "#857258", "#a18c6b", "#c5ad85", "#e5cba0"],
  stoneCold: ["#2f4148", "#44565a", "#5c716e", "#7b928b", "#aac0ac", "#d4d8ba"],
  clothRose: ["#512d3f", "#743b54", "#9d5168", "#bb6776", "#db8893", "#f5b8b0"],
  clothBlue: ["#23344b", "#304d60", "#486b83", "#638da0", "#87b2ba", "#c0d4ca"],
  lilac: ["#3c3452", "#55446b", "#805689", "#9e74a5", "#c49dc8", "#e8bfd4"],
  paper: ["#a87b50", "#c5a372", "#e4c997", "#fcdfa9"],
} as const
type Ramp = keyof typeof ramps
type Group = readonly [ramp: Ramp, orderedSourceKeys: string]

const materials: Record<string, readonly Group[]> = {
  "oak-tree": [
    ["oak", "agfecbd"],
    ["wood", "lkjih"],
  ],
  "pine-tree": [
    ["pine", "agfcebd"],
    ["wood", "hlkji"],
  ],
  "cherry-tree": [
    ["blossom", "afedcb"],
    ["wood", "gkjih"],
    ["stem", "lnm"],
  ],
  "sunflower": [
    ["brass", "ageicb"],
    ["wood", "fdh"],
    ["stem", "njlkm"],
  ],
  "pink-tulip": [
    ["blossom", "afedbc"],
    ["stem", "gjih"],
  ],
  "lavender": [
    ["lilac", "aedcb"],
    ["stem", "gkjih"],
  ],
  "owl-statue": [
    ["stoneCold", "afcbde"],
    ["brass", "jihg"],
    ["stem", "kml"],
  ],
  "star-statue": [
    ["brass", "aecbd"],
    ["stoneCold", "fjihg"],
    ["stem", "kml"],
  ],
  "rose-pennant": [
    ["clothRose", "glnmkf"],
    ["brass", "adecb"],
    ["wood", "hji"],
    ["stone", "pvusr"],
    ["stem", "otq"],
  ],
  "blue-banner": [
    ["clothBlue", "egjnhi"],
    ["brass", "adfcb"],
    ["wood", "kml"],
    ["stoneCold", "pvusr"],
    ["stem", "otq"],
  ],
  "stone-lantern": [
    ["limestone", "afedcb"],
    ["brass", "hijkl"],
    ["stem", "mon"],
  ],
}

const originals = new Map(rewardItems.map(({ id, artifact }) => [id, artifact]))
const originalIds = new Map(rewardItems.map(({ id, artifact }) => [artifact, id]))
const trees = new Set(
  rewardItems.filter(({ category }) => category === "Trees").map(({ id }) => id),
)
const flowers = new Set(
  rewardItems.filter(({ category }) => category === "Flowers").map(({ id }) => id),
)
export const isTreeArt = (id: string) => trees.has(id)
export const hasGrowthArt = (id: string) => trees.has(id) || flowers.has(id)

const artCache = new Map<string, PixelArt>()

function texturedColor(ramp: Ramp, index: number, x: number, y: number, seed: number) {
  const tones: readonly string[] = ramps[ramp]
  // Contours and deepest recesses stay quiet. Shapes are painted in 2–5 px
  // clusters rather than sprinkling single pixels indiscriminately.
  if (index <= 1 || index === tones.length - 1) return tones[index]!
  const cell = hash(Math.floor((x + 0.5 * y) / 4), Math.floor(y / 3), seed)
  const stroke = (x + y * 3 + seed) % 7
  if (ramp === "wood") {
    const vein = hash(Math.floor(x / 2), Math.floor(y / 7), seed)
    index += vein > 0.77 && stroke < 3 ? 1 : vein < 0.17 && stroke > 2 ? -1 : 0
  } else if (ramp === "stone" || ramp === "stoneCold" || ramp === "limestone") {
    index += cell > 0.7 && (y + Math.floor(x / 6)) % 5 === 0 ? 1 : cell < 0.19 ? -1 : 0
  } else if (ramp === "clothRose" || ramp === "clothBlue") {
    index += cell < 0.23 ? -1 : y % 4 === 1 && stroke > 4 ? 1 : 0
  } else {
    index += cell > 0.68 && stroke < 5 ? 1 : cell < 0.21 ? -1 : 0
  }
  return tones[index]!
}

function paintCatalog(id: string, original: PixelArt) {
  if (id === "reading-bench") return readingBenchArt
  const groups = materials[id]
  if (!groups) return original
  const bitmap = createBitmap(original.pixels[0]!.length, original.pixels.length)
  const colors = new Map<string, { ramp: Ramp; index: number }>()
  for (const [ramp, keys] of groups) {
    Array.from(keys).forEach((key, order) =>
      colors.set(key, {
        ramp,
        // A small but bright window still has contrast with its shadowed frame.
        index:
          keys.length === 1
            ? ramps[ramp].length - 2
            : Math.round((order * (ramps[ramp].length - 1)) / (keys.length - 1)),
      }),
    )
  }
  const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  original.pixels.forEach((row, y) =>
    Array.from(row).forEach((key, x) => {
      if (key === ".") return
      const color = colors.get(key)
      put(
        bitmap,
        x,
        y,
        color ? texturedColor(color.ramp, color.index, x, y, seed) : original.palette[key]!,
      )
    }),
  )

  // Hand-picked accents are clipped to the source's silhouette. They pull the
  // eye toward the function of each prop, not towards the texture itself.
  const mark = (x: number, y: number, color: string) => {
    if (isSet(bitmap, x, y)) put(bitmap, x, y, color)
  }
  const relief = (
    runs: readonly (readonly [y: number, from: number, to: number, color: string])[],
  ) => {
    for (const [y, from, to, color] of runs) for (let x = from; x <= to; x++) mark(x, y, color)
  }
  if (id === "stone-lantern") {
    // The bevel catches the same upper-left light as the cottage stone.
    // Amber glass sits behind an iron frame; light stays inside the sprite.
    relief([
      [6, 12, 15, "#e6cba0"],
      [7, 9, 15, "#d1b486"],
      [7, 17, 21, "#a18b67"],
      [8, 8, 14, "#bda477"],
      [8, 16, 22, "#927c59"],
      [8, 23, 25, "#69724a"],
      [9, 7, 16, "#e0c293"],
      [9, 17, 23, "#af9369"],
      [10, 8, 22, "#5b4938"],
      [11, 12, 19, harborLamp.metal],
      [12, 13, 18, harborLamp.ember],
      [13, 13, 18, harborLamp.amber],
      [14, 13, 18, "#f4bb65"],
      [15, 13, 18, harborLamp.amber],
      [16, 13, 18, harborLamp.ember],
      [17, 9, 21, "#66503c"],
      [17, 14, 18, "#bb844c"],
      [18, 9, 15, "#e6c598"],
      [18, 16, 21, "#b99c72"],
      [20, 13, 16, "#af956d"],
      [21, 14, 16, "#cbad81"],
      [22, 14, 15, "#c3a67b"],
      [25, 12, 17, "#d5b88b"],
      [27, 10, 16, "#cfb488"],
      [28, 10, 12, "#727950"],
    ])
    for (let y = 12; y <= 16; y++) {
      mark(11, y, "#cdad80")
      mark(12, y, harborLamp.metal)
      mark(19, y, harborLamp.metal)
      mark(20, y, "#a98a64")
    }
    mark(16, 13, "#ffd77f")
    mark(15, 14, harborLamp.flame)
    mark(16, 14, "#fff3bc")
    mark(16, 15, harborLamp.flame)
    mark(17, 15, "#f7c775")
  } else if (id === "owl-statue") {
    mark(11, 9, "#fff1ac")
    mark(19, 9, "#fff1ac")
    mark(12, 10, "#364344")
    mark(20, 10, "#364344")
    for (const [x, y] of [
      [11, 16],
      [13, 18],
      [16, 17],
      [11, 20],
      [15, 21],
      [18, 19],
    ])
      mark(x!, y!, "#a0a68a")
  } else if (id === "star-statue") {
    for (const [x, y] of [
      [15, 3],
      [16, 4],
      [16, 5],
      [13, 8],
      [12, 8],
      [14, 9],
      [16, 10],
    ])
      mark(x!, y!, "#ffecad")
  } else if (id === "sunflower") {
    relief([
      [4, 15, 16, "#ffdfa0"],
      [6, 10, 12, "#fff0ae"],
      [7, 12, 16, "#9c613d"],
      [8, 12, 18, "#815339"],
      [9, 12, 18, "#624633"],
      [10, 12, 17, "#694433"],
      [11, 13, 17, "#593e33"],
      [12, 14, 17, "#75482f"],
      [10, 8, 10, "#edb653"],
      [12, 18, 20, "#d38d42"],
      [14, 16, 17, "#b36d39"],
    ])
    mark(13, 8, "#d39351")
    mark(15, 9, "#a76843")
    mark(16, 10, "#955b3b")
  } else if (id === "pink-tulip") {
    relief([
      [8, 10, 11, "#ffe7c9"],
      [9, 10, 11, "#f6b7aa"],
      [8, 15, 16, "#f9c3ac"],
      [9, 15, 17, "#e89593"],
      [10, 16, 17, "#e28586"],
      [9, 20, 21, "#e89b97"],
      [12, 14, 17, "#b55c72"],
      [13, 15, 20, "#a45066"],
      [14, 14, 20, "#884459"],
    ])
    mark(13, 10, "#a7566b")
    mark(14, 11, "#a7566b")
    mark(18, 10, "#873d56")
    mark(18, 11, "#873d56")
  } else if (id === "lavender") {
    // Distinct little pairs of blossoms at each stem tip; keep stems quiet.
    for (const [x, y] of [
      [14, 5],
      [9, 9],
      [20, 8],
      [4, 14],
      [25, 13],
    ] as const) {
      mark(x, y, "#f4c6cf")
      mark(x, y + 1, "#d199c1")
      mark(x + 1, y + 2, "#7b5589")
    }
  } else if (id === "rose-pennant" || id === "blue-banner") {
    for (const [x, y] of [
      [13, 8],
      [15, 8],
      [17, 8],
      [14, 14],
      [16, 13],
      [18, 12],
    ])
      mark(x!, y!, id === "rose-pennant" ? "#f5b8b0" : "#c0d4ca")
  }
  return bitmapToPixelArt(bitmap)
}

function treeStageArt(id: string, stage: "sprout" | "young") {
  const bitmap = createBitmap(32, 32)
  const color = id === "pine-tree" ? ramps.pine : id === "cherry-tree" ? ramps.blossom : ramps.oak
  const poly = (points: Point[], tone: string) => fillPolygon(bitmap, points, () => tone)
  const bark = ramps.wood
  // All growth frames share the mature art's root line at row 29.
  for (let y = stage === "sprout" ? 23 : 15; y <= 29; y++) {
    const root = y >= 28
    put(bitmap, 14, y, bark[0])
    put(bitmap, 15, y, y % 3 === 0 ? bark[4] : bark[3])
    put(bitmap, 16, y, bark[2])
    put(bitmap, 17, y, bark[0])
    if (root) {
      put(bitmap, 13, y, y === 28 ? bark[2] : bark[0])
      put(bitmap, 18, y, y === 28 ? bark[1] : bark[0])
    }
  }
  if (id === "pine-tree") {
    const tiers =
      stage === "sprout"
        ? [
            [19, 26, 3],
            [22, 29, 4],
          ]
        : [
            [11, 19, 4],
            [16, 23, 6],
            [20, 26, 7],
          ]
    for (const [top, bottom, radius] of tiers as [number, number, number][]) {
      poly(
        [
          [16, top],
          [16 + radius, bottom],
          [16 - radius, bottom],
        ],
        color[0],
      )
      poly(
        [
          [16, top + 1],
          [16, bottom - 2],
          [17 - radius, bottom - 1],
        ],
        color[3],
      )
      poly(
        [
          [16, top + 2],
          [15 + radius, bottom - 1],
          [16, bottom - 2],
        ],
        color[1],
      )
      put(bitmap, 15, bottom - 3, color[4])
    }
  } else if (stage === "sprout") {
    // Pair of large leaves, clearly not a miniature mature canopy.
    poly(
      [
        [8, 20],
        [12, 20],
        [16, 24],
        [16, 26],
        [12, 25],
        [9, 23],
      ],
      color[0],
    )
    poly(
      [
        [9, 21],
        [12, 21],
        [15, 24],
        [12, 24],
      ],
      color[4],
    )
    poly(
      [
        [16, 24],
        [18, 20],
        [23, 19],
        [22, 23],
        [16, 26],
      ],
      color[1],
    )
    poly(
      [
        [17, 24],
        [19, 21],
        [22, 20],
        [21, 22],
      ],
      color[3],
    )
    put(bitmap, 10, 21, color[5])
    put(bitmap, 20, 21, color[5])
  } else {
    // Young broadleaf tree: three overlapping crowns with a sunlit upper left.
    const crowns =
      id === "cherry-tree"
        ? [
            [21, 18, 5],
            [12, 17, 6],
            [17, 15, 5],
          ]
        : [
            [21, 18, 4],
            [11, 17, 5],
            [16, 13, 5],
          ]
    for (const [x, y, r] of crowns as [number, number, number][]) {
      const crown: Point[] = [
        [x - r, y - 1],
        [x - r + 2, y - r + 1],
        [x, y - r],
        [x + r - 2, y - r + 1],
        [x + r, y],
        [x + r - 1, y + r - 1],
        [x, y + r],
        [x - r + 1, y + r - 1],
      ]
      fillPolygon(bitmap, crown, (px, py) => {
        const shade = Math.max(1, Math.min(4, Math.round(3.4 - (px - x + (py - y)) / r)))
        return texturedColor(id === "cherry-tree" ? "blossom" : "oak", shade, px, py, r * 5)
      })
      put(bitmap, x - 1, y - 2, color[5])
      put(bitmap, x - 2, y - 2, color[5])
    }
  }
  return bitmapToPixelArt(bitmap)
}

function flowerStageArt(id: string, stage: "sprout" | "young") {
  const bitmap = createBitmap(32, 32)
  const greens = ramps.stem
  const poly = (points: Point[], tone: string) => fillPolygon(bitmap, points, () => tone)
  const bud = stage === "young"
  const stemTop = !bud ? 24 : id === "lavender" ? 16 : 17
  for (let y = stemTop; y < 29; y++) {
    put(bitmap, 15, y, greens[0])
    put(bitmap, 16, y, greens[y % 4 < 2 ? 2 : 3])
  }
  const leaf = (left: boolean, y: number) => {
    const x = left ? 8 : 22
    poly(
      [
        [x, y],
        [left ? 13 : 19, y + 1],
        [17, y + 6],
        [left ? 12 : 20, y + 5],
      ],
      greens[1],
    )
    poly(
      [
        [left ? 9 : 21, y + 1],
        [left ? 13 : 19, y + 2],
        [16, y + 5],
      ],
      greens[4],
    )
  }
  leaf(true, bud ? 22 : 24)
  leaf(false, bud ? 20 : 23)
  poly(
    [
      [13, 28],
      [16, 27],
      [19, 28],
      [21, 30],
      [11, 30],
    ],
    greens[0],
  )
  put(bitmap, 14, 28, greens[3])
  put(bitmap, 17, 28, greens[2])
  if (bud && id === "sunflower") {
    poly(
      [
        [13, 13],
        [17, 12],
        [21, 15],
        [20, 19],
        [16, 21],
        [12, 18],
      ],
      greens[0],
    )
    poly(
      [
        [14, 14],
        [17, 13],
        [19, 15],
        [17, 18],
        [14, 18],
        [13, 16],
      ],
      ramps.brass[3],
    )
    put(bitmap, 15, 14, ramps.brass[5])
    put(bitmap, 16, 14, ramps.brass[5])
  } else if (bud && id === "pink-tulip") {
    poly(
      [
        [12, 12],
        [16, 14],
        [20, 12],
        [21, 16],
        [19, 20],
        [14, 21],
        [12, 18],
      ],
      ramps.blossom[1],
    )
    poly(
      [
        [13, 14],
        [16, 15],
        [16, 19],
        [14, 18],
        [13, 16],
      ],
      ramps.blossom[5],
    )
    poly(
      [
        [16, 15],
        [19, 14],
        [20, 16],
        [18, 19],
        [16, 20],
      ],
      ramps.blossom[3],
    )
  } else if (bud) {
    // Lavender buds are vertical beads rather than one round head.
    for (const [x, y, size] of [
      [14, 12, 2],
      [17, 14, 3],
      [11, 17, 2],
      [18, 19, 2],
    ] as const) {
      put(bitmap, x, y - 1, ramps.lilac[1])
      put(bitmap, x, y, ramps.lilac[5])
      put(bitmap, x + 1, y, ramps.lilac[3])
      for (let i = 0; i < size; i++) put(bitmap, x, y + 1 + i, ramps.lilac[2])
      for (let step = 0; step <= 6; step++)
        put(bitmap, Math.round(x + ((16 - x) * step) / 6), y + size + 1 + step, greens[2])
    }
  }
  return bitmapToPixelArt(bitmap)
}

export function detailedCatalogArt(
  id: string,
  stage: TreeArtStage = "mature",
): PixelArt | undefined {
  const original = originals.get(id)
  if (!original) return undefined
  const phase = hasGrowthArt(id) ? stage : "mature"
  const key = `${id}:${phase}`
  let result = artCache.get(key)
  if (!result) {
    result =
      phase === "mature"
        ? paintCatalog(id, original)
        : isTreeArt(id)
          ? treeStageArt(id, phase)
          : flowerStageArt(id, phase)
    artCache.set(key, result)
  }
  return result
}

export function detailedRewardArt(original: PixelArt, stage: TreeArtStage = "mature"): PixelArt {
  const id = originalIds.get(original)
  return id ? (detailedCatalogArt(id, stage) ?? original) : original
}

export type DetailedSpriteKind = "nature" | "boat" | "buoy" | "sea-rock" | "sign" | "jetty"
const bitmapCache = new WeakMap<Bitmap, Map<DetailedSpriteKind, Bitmap>>()
const channel = (value: number) => Math.round(Math.max(0, Math.min(255, value)))

/** Relit procedural sprite. Copy RGB only; the alpha mask and geometry remain untouched. */
export function detailedSpriteBitmap(bitmap: Bitmap, kind: DetailedSpriteKind): Bitmap {
  let variants = bitmapCache.get(bitmap)
  if (!variants) bitmapCache.set(bitmap, (variants = new Map()))
  const cached = variants.get(kind)
  if (cached) return cached
  const output = createBitmap(bitmap.width, bitmap.height)
  output.rgba.set(bitmap.rgba)
  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      const i = (y * bitmap.width + x) * 4
      if (!bitmap.rgba[i + 3]) continue
      const [red, green, blue] = [bitmap.rgba[i]!, bitmap.rgba[i + 1]!, bitmap.rgba[i + 2]!]
      const light = (red * 2 + green * 3 + blue) / 6
      const greenLeaf = green > red + 5 && green > blue + 12
      const timber = red > blue + 19 && red > green + 11
      const texture = noise(x + y / 4, y, 4, 147)
      const seam = (y + Math.floor(x / 2)) % 5 === 0
      const stitch = seam && hash(x >> 2, y >> 1, 119) > 0.36
      const bright = light > 85 && texture > 0.64
      const glint = stitch && light > 100
      const lift =
        kind === "boat" || kind === "jetty" || (kind === "sign" && timber)
          ? timber && glint
            ? 13
            : bright
              ? 6
              : -2
          : greenLeaf && bright
            ? 12
            : glint && !timber
              ? 9
              : light < 70
                ? -3
                : 4
      output.rgba[i] = channel(red + lift + (timber ? 7 : kind === "sea-rock" ? -7 : 0))
      output.rgba[i + 1] = channel(green + lift + (kind === "sea-rock" ? 5 : 0))
      output.rgba[i + 2] = channel(
        blue + lift + (greenLeaf || timber ? -6 : kind === "sea-rock" ? 6 : 0),
      )
    }
  }
  variants.set(kind, output)
  return output
}

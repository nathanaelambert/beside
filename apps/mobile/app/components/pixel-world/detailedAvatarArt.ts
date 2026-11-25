import type { PixelArt } from "@beside/rewards"

import type { Avatar } from "./avatars"

type Point = readonly [number, number]
type Layer = string[][]
type Portrait = {
  palette: string
  body: string
  head: string
  eyesOpen: string
  eyesClosed: string
}

const width = 48
const height = 60

// Swatches are key/color pairs; whitespace only groups related entries visually.
function decodePalette(text: string): PixelArt["palette"] {
  const pairs = text.trim().split(/\s+/)
  const palette: PixelArt["palette"] = {}
  for (let i = 0; i < pairs.length; i += 2) palette[pairs[i]!] = pairs[i + 1]!
  return palette
}

// Each line is a palette key and its polygon's x,y pairs, in back-to-front order.
// Coordinates use native texels, independent of the 16 × 20 world rectangle.
function paint(...layers: string[]): Layer {
  const pixels = Array.from({ length: height }, () => Array<string>(width).fill("."))
  for (const row of layers.join("\n").split("\n")) {
    const line = row.trim()
    if (!line) continue
    const color = line[0]!
    const path = line.slice(2)
    const points: Point[] = path.split(" ").map((pair) => {
      const [x, y] = pair.split(",")
      return [Number(x), Number(y)]
    })
    const minY = Math.max(0, Math.min(...points.map((p) => p[1])))
    const maxY = Math.min(height, Math.max(...points.map((p) => p[1])))
    for (let y = minY; y < maxY; y++) {
      const intersections: number[] = []
      const center = y + 0.5
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i]!
        const [x2, y2] = points[(i + 1) % points.length]!
        if (y1 > center !== y2 > center) {
          intersections.push(x1 + ((center - y1) * (x2 - x1)) / (y2 - y1))
        }
      }
      intersections.sort((a, b) => a - b)
      for (let i = 0; i < intersections.length; i += 2) {
        const start = Math.max(0, Math.ceil(intersections[i]! - 0.5))
        const end = Math.min(width, Math.ceil(intersections[i + 1]! - 0.5))
        for (let x = start; x < end; x++) pixels[y]![x] = color
      }
    }
  }
  return pixels
}

export function portraitFrames({
  palette,
  body,
  head,
  eyesOpen,
  eyesClosed,
}: Portrait): Avatar["frames"] {
  const base = paint(body)
  const open = paint(head, eyesOpen)
  const closed = paint(head, eyesClosed)
  const swatches = decodePalette(palette)
  const pose = (face: Layer, drop: number): PixelArt => ({
    format: "pixel-art",
    palette: swatches,
    pixels: base.map((row, y) =>
      row
        .map((value, x) => {
          const over = face[y - drop]?.[x]
          return over && over !== "." ? over : value
        })
        .join(""),
    ),
  })
  return {
    idle: pose(open, 0),
    blink: pose(closed, 0),
    // Only the head settles. The shoes, body anchor and hit rectangle do not move.
    breathe: pose(open, 2),
  }
}

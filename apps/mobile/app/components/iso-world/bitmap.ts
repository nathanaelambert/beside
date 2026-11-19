import type { PixelArt } from "@beside/rewards"

/** A plain RGBA buffer. Alpha is always 0 or 255 so pixel art stays crisp. */
export interface Bitmap {
  width: number
  height: number
  rgba: Uint8Array
}

export type Rgb = readonly [number, number, number]

const parsed = new Map<string, Rgb>()
export function rgb(hex: string): Rgb {
  let value = parsed.get(hex)
  if (!value) {
    value = [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ]
    parsed.set(hex, value)
  }
  return value
}

export function createBitmap(width: number, height: number): Bitmap {
  return { width, height, rgba: new Uint8Array(width * height * 4) }
}

export function put(bitmap: Bitmap, x: number, y: number, color: string | Rgb) {
  if (x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height) return
  const [r, g, b] = typeof color === "string" ? rgb(color) : color
  const i = (y * bitmap.width + x) * 4
  bitmap.rgba[i] = r
  bitmap.rgba[i + 1] = g
  bitmap.rgba[i + 2] = b
  bitmap.rgba[i + 3] = 255
}

export function isSet(bitmap: Bitmap, x: number, y: number) {
  if (x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height) return false
  return bitmap.rgba[(y * bitmap.width + x) * 4 + 3] !== 0
}

/** Draw `art` into `bitmap` with its top-left at (x, y). */
export function stamp(bitmap: Bitmap, art: PixelArt, x: number, y: number) {
  art.pixels.forEach((row, dy) =>
    [...row].forEach((key, dx) => {
      if (key !== ".") put(bitmap, x + dx, y + dy, art.palette[key]!)
    }),
  )
}

/** Wrap opaque pixels in a 1px outline, like the hand-drawn sprites. */
export function outline(bitmap: Bitmap, color: string) {
  const { width, height } = bitmap
  const edge: [number, number][] = []
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (
        !isSet(bitmap, x, y) &&
        (isSet(bitmap, x - 1, y) ||
          isSet(bitmap, x + 1, y) ||
          isSet(bitmap, x, y - 1) ||
          isSet(bitmap, x, y + 1))
      )
        edge.push([x, y])
  for (const [x, y] of edge) put(bitmap, x, y, color)
}

/** Convert a bitmap to the shared PixelArt format, so plain React Native views can draw it. */
export function bitmapToPixelArt(bitmap: Bitmap): PixelArt {
  const keys = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  const palette: Record<string, string> = {}
  const lookup = new Map<string, string>()
  const pixels: string[] = []
  for (let y = 0; y < bitmap.height; y++) {
    let row = ""
    for (let x = 0; x < bitmap.width; x++) {
      const i = (y * bitmap.width + x) * 4
      if (!bitmap.rgba[i + 3]) {
        row += "."
        continue
      }
      const hex =
        "#" +
        [bitmap.rgba[i]!, bitmap.rgba[i + 1]!, bitmap.rgba[i + 2]!]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("")
      let key = lookup.get(hex)
      if (!key) {
        key = keys[lookup.size % keys.length]!
        lookup.set(hex, key)
        palette[key] = hex
      }
      row += key
    }
    pixels.push(row)
  }
  return { format: "pixel-art", palette, pixels }
}

export function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 982451653)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function noise(x: number, y: number, cell: number, seed: number) {
  const gx = x / cell
  const gy = y / cell
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const tx = gx - x0
  const ty = gy - y0
  const sx = tx * tx * (3 - 2 * tx)
  const sy = ty * ty * (3 - 2 * ty)
  const a = hash(x0, y0, seed)
  const b = hash(x0 + 1, y0, seed)
  const c = hash(x0, y0 + 1, seed)
  const d = hash(x0 + 1, y0 + 1, seed)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

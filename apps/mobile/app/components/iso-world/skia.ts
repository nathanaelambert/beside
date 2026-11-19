import type { PixelArt } from "@beside/rewards"
import {
  AlphaType,
  ColorType,
  FilterMode,
  MipmapMode,
  Skia,
  type SkImage,
} from "@shopify/react-native-skia"

import type { Bitmap } from "./bitmap"

// Nearest-neighbour sampling at integer scales keeps every art pixel crisp.
export const sampling = { filter: FilterMode.Nearest, mipmap: MipmapMode.None }

function makeImage(width: number, height: number, rgba: Uint8Array) {
  // Alpha is only ever 0 or 255, so premultiplied and straight alpha are identical.
  return Skia.Image.MakeImage(
    { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Premul },
    Skia.Data.fromBytes(rgba),
    width * 4,
  )
}

const bitmapImages = new WeakMap<Bitmap, SkImage | null>()
export function bitmapImage(bitmap: Bitmap) {
  let image = bitmapImages.get(bitmap)
  if (image === undefined) {
    image = makeImage(bitmap.width, bitmap.height, bitmap.rgba)
    bitmapImages.set(bitmap, image)
  }
  return image
}

const artImages = new Map<PixelArt, SkImage | null>()
export function artImage(art: PixelArt) {
  let image = artImages.get(art)
  if (image === undefined) {
    const width = art.pixels[0]!.length
    const rgba = new Uint8Array(width * art.pixels.length * 4)
    art.pixels.forEach((row, y) =>
      [...row].forEach((key, x) => {
        if (key === ".") return
        const hex = art.palette[key]!
        const i = (y * width + x) * 4
        rgba[i] = parseInt(hex.slice(1, 3), 16)
        rgba[i + 1] = parseInt(hex.slice(3, 5), 16)
        rgba[i + 2] = parseInt(hex.slice(5, 7), 16)
        rgba[i + 3] = 255
      }),
    )
    image = makeImage(width, art.pixels.length, rgba)
    artImages.set(art, image)
  }
  return image
}

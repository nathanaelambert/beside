import { createBitmap, hash, noise, put } from "./bitmap"

const tide = {
  deep: "#27535e",
  ocean: "#295661",
  swell: "#2d5963",
  pond: "#316e78",
  ripple: "#42828a",
  shelf: "#4e948f",
  breaker: "#82b5a7",
  foam: "#dce8d0",
} as const

/** Palette the shore spray without adding pixels to the existing foam mask. */
export function shoreFoamColor(x: number, y: number, drift: number) {
  const surge = noise(x, y, 10, 652)
  const crest = 1.1 + surge * 2.4
  if (drift > crest + 1.4) return tide.swell
  if (drift > crest + 0.5) return tide.ripple
  if (Math.abs(drift - crest) <= 0.85 && surge > 0.39)
    return surge > 0.59 ? tide.foam : tide.breaker
  return drift < 2 ? tide.shelf : tide.ripple
}

/** The near-bank tint follows the existing water cells, not a separate shore shape. */
export function pondWaterColor(x: number, y: number, bank: number) {
  const depth = bank + (noise(x, y, 7, 154) - 0.5) * 0.22
  const ripple = Math.floor(y + x * 0.16 + noise(x, y, 18, 71) * 3) % 8
  const group = hash(Math.floor(x / 6), Math.floor(y / 4), 95)
  if (depth < 0.048) return group > 0.68 ? tide.breaker : tide.shelf
  if (depth < 0.24) return ripple === 2 && group > 0.4 ? tide.breaker : tide.shelf
  if (ripple === 2 && group > 0.42) return tide.ripple
  return noise(x, y, 12, 27) > 0.47 ? tide.pond : tide.swell
}

/** Seamless, subdued currents offshore, where the foam is only an occasional glint. */
export function paintOpenWater(width: number, height: number) {
  const bitmap = createBitmap(width, height)
  const tau = Math.PI * 2
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width
      const v = (y + 0.5) / height
      const swell = Math.sin(tau * (3 * v + 0.15 * Math.sin(tau * u)))
      const crossing = Math.cos(tau * (5 * v - u))
      const surface = swell * 0.75 + crossing * 0.25
      put(bitmap, x, y, surface > 0.64 ? tide.swell : surface < -0.56 ? tide.deep : tide.ocean)
    }
  }
  for (const [x, y, length] of [
    [3, 4, 9],
    [31, 7, 11],
    [56, 12, 8],
    [14, 17, 9],
    [35, 22, 8],
    [1, 25, 6],
    [50, 29, 10],
  ] as const)
    for (let i = 0; i < length; i++) {
      if (i === length - 3) continue
      put(
        bitmap,
        (x + i) % width,
        (y + (i > length / 2 ? 1 : 0)) % height,
        i > 1 && i < length - 3 ? tide.ripple : tide.swell,
      )
    }
  return bitmap
}

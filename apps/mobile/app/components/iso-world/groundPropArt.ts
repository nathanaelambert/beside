import { createBitmap, type Bitmap } from "./bitmap"

/**
 * Select whole pixel rows for a shorter silhouette. Keep the frame and lower
 * rows byte-for-byte so the prop still meets the ground in the same place.
 */
export function compactGroundProp(
  source: Bitmap,
  upperRows: readonly number[],
  footing: number,
  crownWidth: number,
) {
  const { width, height, rgba } = source
  const output = createBitmap(width, height)
  const stride = width * 4
  const center = width / 2
  const start = footing - upperRows.length
  upperRows.forEach((sourceY, i) => {
    const y = start + i
    // Widen back to the original width near the unmodified footing.
    const widthRatio = 1 - (1 - crownWidth) * Math.min(1, (footing - y - 1) / 3)
    for (let x = 0; x < width; x++) {
      const from = Math.floor(center + (x + 0.5 - center) / widthRatio)
      if (from < 0 || from >= width) continue
      const index = sourceY * stride + from * 4
      output.rgba.set(rgba.subarray(index, index + 4), y * stride + x * 4)
    }
  })
  output.rgba.set(rgba.subarray(footing * stride), footing * stride)
  return output
}

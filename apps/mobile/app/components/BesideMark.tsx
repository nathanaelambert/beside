import { memo, useEffect, useMemo, useState } from "react"
// eslint-disable-next-line no-restricted-imports
import { AccessibilityInfo, PixelRatio, View, ViewStyle } from "react-native"
import type { PixelArt } from "@beside/rewards"

import { AVATAR_HEIGHT, AVATAR_WIDTH, avatars } from "@/components/pixel-world/avatars"

/**
 * Snaps an art-pixel size to whole device pixels. On fractional densities (e.g. 2.625x),
 * unsnapped sizes leave hairline seams between neighbouring pixel runs.
 */
export function snapScale(scale: number) {
  const ratio = PixelRatio.get()
  return Math.max(1, Math.round(scale * ratio)) / ratio
}

/** Native views at whole-device-pixel scales keep pixel art crisp, without a native dependency. */
export const PixelArtSprite = memo(function PixelArtSprite({
  art,
  scale: requestedScale = 3,
  style,
}: {
  art: PixelArt
  scale?: number
  style?: ViewStyle
}) {
  const scale = snapScale(requestedScale)
  const { pixels, palette } = art
  const runs = useMemo(
    () =>
      pixels.flatMap((row, y) => {
        const result: ViewStyle[] = []
        for (let x = 0; x < row.length;) {
          const color = row[x]
          let end = x + 1
          while (end < row.length && row[end] === color) end++
          if (color !== ".")
            result.push({
              position: "absolute",
              left: x * scale,
              top: y * scale,
              width: (end - x) * scale,
              height: scale,
              backgroundColor: palette[color],
            })
          x = end
        }
        return result
      }),
    [pixels, palette, scale],
  )

  return (
    <View
      style={[{ width: pixels[0].length * scale, height: pixels.length * scale }, style]}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {runs.map((runStyle, index) => (
        <View key={index} style={runStyle} />
      ))}
    </View>
  )
})

// Two friends stand side by side, one pixel of space between them.
const STEP = 17
export const MARK_WIDTH = STEP + AVATAR_WIDTH
export const MARK_HEIGHT = AVATAR_HEIGHT

type Frame = "idle" | "blink" | "breathe"

// A slow idle loop: breathe in and out, with an occasional blink. Each avatar is offset.
const CYCLE: Frame[] = ["idle", "idle", "breathe", "idle", "idle", "blink", "idle", "breathe"]

function useIdleFrame(animated: boolean) {
  const [tick, setTick] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    let active = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => active && setReduceMotion(enabled))
      .catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion)
    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    if (!animated || reduceMotion) return undefined
    const id = setInterval(() => setTick((value) => value + 1), 420)
    return () => clearInterval(id)
  }, [animated, reduceMotion])

  return (phase: number): Frame =>
    animated && !reduceMotion ? CYCLE[(tick + phase) % CYCLE.length] : "idle"
}

/** Beside's mark: two people, side by side. */
export function BesideMark({
  scale = 4,
  animated = false,
}: {
  scale?: number
  animated?: boolean
}) {
  const frameFor = useIdleFrame(animated)
  const [left, right] = avatars
  const snapped = snapScale(scale)

  return (
    <View
      style={{ width: MARK_WIDTH * snapped, height: MARK_HEIGHT * snapped }}
      accessibilityRole="image"
      accessibilityLabel="Beside"
    >
      <PixelArtSprite art={left.frames[frameFor(0)]} scale={scale} style={$layer} />
      <PixelArtSprite
        art={right.frames[frameFor(3)]}
        scale={scale}
        style={{ ...$layer, left: STEP * snapped }}
      />
    </View>
  )
}

const $layer: ViewStyle = { position: "absolute", left: 0, top: 0 }

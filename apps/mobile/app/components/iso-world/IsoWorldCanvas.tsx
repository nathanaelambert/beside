import { memo, useEffect, useMemo, useRef } from "react"
import { StyleSheet } from "react-native"
import { Canvas, Group, Image, ImageShader, Path, Rect } from "@shopify/react-native-skia"
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler"
import {
  runOnJS,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated"

import type { Bitmap } from "./bitmap"
import { paintGround, SEA_TILE, seaTile, waterGlints } from "./paint"
import { isoToScreen, type MapFrame } from "./projection"
import { hitTest, type Drawable, type HitTarget } from "./scene"
import { artImage, bitmapImage, sampling } from "./skia"
import type { TileMap } from "./tilemap"
import type { Avatar } from "../pixel-world/avatars"

// Kept out of JSX: the i18n test reads quoted tx props as translation keys.
const repeat = "repeat" as const

const grounds = new WeakMap<TileMap, Bitmap>()
function groundFor(map: TileMap, frame: MapFrame) {
  let ground = grounds.get(map)
  if (!ground) grounds.set(map, (ground = paintGround(map, frame)))
  return ground
}

// A pixel-stepped ellipse, flattened 3:1 to sit on the iso ground plane.
const shadowPaths = new Map<number, string>()
function shadowPath(width: number) {
  let d = shadowPaths.get(width)
  if (!d) {
    const rx = width / 2
    const ry = Math.max(1.5, width / 6)
    d = ""
    for (let y = 0; y < Math.ceil(ry * 2); y++) {
      const dy = (y + 0.5 - ry) / ry
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - dy * dy)))
      if (half > 0) d += `M${-half} ${y - Math.floor(ry)}h${half * 2}v1h${-half * 2}z`
    }
    shadowPaths.set(width, d)
  }
  return d
}

function diamondPath(frame: MapFrame, col: number, row: number, lift: number, inset = 0.12) {
  const a = isoToScreen(frame, col + inset, row + inset, lift)
  const b = isoToScreen(frame, col + 1 - inset, row + inset, lift)
  const c = isoToScreen(frame, col + 1 - inset, row + 1 - inset, lift)
  const d = isoToScreen(frame, col + inset, row + 1 - inset, lift)
  return `M${a.x} ${a.y}L${b.x} ${b.y}L${c.x} ${c.y}L${d.x} ${d.y}Z`
}

const pointerFill = "M-2 0h5v1h-1v1h-1v1h-1v-1h-1v-1h-1z"
const pointerOutline =
  "M-3 -1h7v1h-7zM-3 0h1v1h-1zM3 0h1v1h-1zM-2 1h1v1h-1zM2 1h1v1h-1zM-1 2h1v1h-1zM1 2h1v1h-1zM0 3h1v1h-1z"

function AvatarFrames({
  drawable,
  avatar,
  tick,
}: {
  drawable: Drawable
  avatar: Avatar
  tick: SharedValue<number>
}) {
  // Breathe for a beat every two seconds; blink now and then. Discrete frames, never tweened.
  const frame = useDerivedValue(() => {
    const t = tick.value + avatar.phase
    if (t % 23 === 0 || t % 41 === 0) return 1
    return Math.floor(t / 8) % 2 === 1 ? 2 : 0
  })
  const idle = useDerivedValue(() => (frame.value === 0 ? 1 : 0))
  const blink = useDerivedValue(() => (frame.value === 1 ? 1 : 0))
  const breathe = useDerivedValue(() => (frame.value === 2 ? 1 : 0))
  const props = {
    x: drawable.x,
    y: drawable.y,
    width: drawable.width,
    height: drawable.height,
    sampling,
  }
  return (
    <>
      <Image image={artImage(avatar.frames.idle)} opacity={idle} {...props} />
      <Image image={artImage(avatar.frames.blink)} opacity={blink} {...props} />
      <Image image={artImage(avatar.frames.breathe)} opacity={breathe} {...props} />
    </>
  )
}

const DrawableNode = memo(function DrawableNode({
  drawable,
  tick,
}: {
  drawable: Drawable
  tick: SharedValue<number>
}) {
  const { source } = drawable
  return (
    <Group opacity={drawable.opacity ?? 1}>
      {!!drawable.shadow && (
        <Group transform={[{ translateX: drawable.baseX }, { translateY: drawable.baseY }]}>
          <Path
            path={shadowPath(drawable.shadow)}
            color="rgba(28, 48, 30, 0.32)"
            antiAlias={false}
          />
        </Group>
      )}
      {source.type === "avatar" ? (
        <AvatarFrames drawable={drawable} avatar={source.avatar} tick={tick} />
      ) : (
        <Image
          image={source.type === "bitmap" ? bitmapImage(source.bitmap) : artImage(source.art)}
          x={drawable.x}
          y={drawable.y}
          width={drawable.width}
          height={drawable.height}
          sampling={sampling}
        />
      )}
    </Group>
  )
})

function Glint({
  x,
  y,
  phase,
  tick,
}: {
  x: number
  y: number
  phase: number
  tick: SharedValue<number>
}) {
  const opacity = useDerivedValue(() => (Math.floor((tick.value + phase) / 3) % 4 === 0 ? 0.95 : 0))
  return <Rect x={x} y={y} width={3} height={1} color="#e9f6ec" opacity={opacity} />
}

function Marker({ x, top, tick }: { x: number; top: number; tick: SharedValue<number> }) {
  const transform = useDerivedValue(() => [
    { translateX: x },
    { translateY: top - 7 + (Math.floor(tick.value / 4) % 2) },
  ])
  return (
    <Group transform={transform}>
      <Path path={pointerOutline} color="#2f4434" antiAlias={false} />
      <Path path={pointerFill} color="#fff4cf" antiAlias={false} />
    </Group>
  )
}

function Guide({
  path,
  tick,
  strong,
}: {
  path: string
  tick: SharedValue<number>
  strong?: boolean
}) {
  const opacity = useDerivedValue(() =>
    strong ? 0.7 : Math.floor(tick.value / 5) % 2 === 0 ? 0.42 : 0.26,
  )
  return <Path path={path} color="#fff4cf" opacity={opacity} antiAlias={false} />
}

export interface IsoWorldCanvasProps {
  width: number
  height: number
  map: TileMap
  frame: MapFrame
  /** Sorted back to front. */
  drawables: Drawable[]
  /** Art pixels per point. */
  zoom: number
  /** Tile-space point the camera centres on. */
  focus: { u: number; v: number }
  /** Increment to re-centre the camera on `focus`. */
  resetCamera?: number
  selectedKey?: string
  /** Tiles to mark as available (planting guide). */
  guideTiles?: { col: number; row: number }[]
  /** The tile currently previewed for placement. */
  previewTile?: { col: number; row: number }
  interactive?: boolean
  accessibilityLabel?: string
  onTap?: (result: { hit?: HitTarget; x: number; y: number }) => void
  onPinch?: (direction: 1 | -1) => void
}

export function IsoWorldCanvas({
  width,
  height,
  map,
  frame,
  drawables,
  zoom,
  focus,
  resetCamera = 0,
  selectedKey,
  guideTiles,
  previewTile,
  interactive = true,
  accessibilityLabel,
  onTap,
  onPinch,
}: IsoWorldCanvasProps) {
  const ground = groundFor(map, frame)
  const glints = useMemo(() => waterGlints(map, frame), [map, frame])
  const cameraX = useSharedValue(0)
  const cameraY = useSharedValue(0)
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  const tick = useSharedValue(0)
  const reduceMotion = useReducedMotion()
  const lastZoom = useRef(zoom)

  const clampAxis = (value: number, viewport: number, extent: number) => {
    "worklet"
    return viewport >= extent
      ? Math.round((viewport - extent) / 2)
      : Math.min(0, Math.max(viewport - extent, value))
  }

  // Centre on the focus point when mounted or asked to recentre.
  useEffect(() => {
    const p = isoToScreen(frame, focus.u, focus.v)
    cameraX.value = clampAxis(Math.round(width / 2 - p.x * zoom), width, frame.width * zoom)
    cameraY.value = clampAxis(Math.round(height / 2 - p.y * zoom), height, frame.height * zoom)
    lastZoom.current = zoom
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetCamera, width, height, frame])

  // Zooming keeps whatever is in the middle of the view in the middle.
  useEffect(() => {
    const previous = lastZoom.current
    if (previous === zoom) return
    const cx = (width / 2 - cameraX.value) / previous
    const cy = (height / 2 - cameraY.value) / previous
    cameraX.value = clampAxis(Math.round(width / 2 - cx * zoom), width, frame.width * zoom)
    cameraY.value = clampAxis(Math.round(height / 2 - cy * zoom), height, frame.height * zoom)
    lastZoom.current = zoom
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom])

  useEffect(() => {
    if (reduceMotion) return
    // A slow, stepped clock: the canvas only redraws when a frame actually changes.
    const id = setInterval(() => {
      tick.value = tick.value + 1
    }, 125)
    return () => clearInterval(id)
  }, [reduceMotion, tick])

  const transform = useDerivedValue(() => [
    { translateX: Math.round(cameraX.value) },
    { translateY: Math.round(cameraY.value) },
    { scale: zoom },
  ])

  const extentX = frame.width * zoom
  const extentY = frame.height * zoom
  const pan = Gesture.Pan()
    .minDistance(8)
    .enabled(interactive)
    .onStart(() => {
      startX.value = cameraX.value
      startY.value = cameraY.value
    })
    .onUpdate((e) => {
      cameraX.value = clampAxis(startX.value + e.translationX, width, extentX)
      cameraY.value = clampAxis(startY.value + e.translationY, height, extentY)
    })
  const handleTap = (x: number, y: number) => {
    const hit = hitTest(drawables, x, y, 44 / zoom)
    onTap?.({ hit, x, y })
  }
  const tap = Gesture.Tap()
    .maxDistance(8)
    .enabled(interactive)
    .onEnd((e, success) => {
      if (success)
        runOnJS(handleTap)(
          (e.x - Math.round(cameraX.value)) / zoom,
          (e.y - Math.round(cameraY.value)) / zoom,
        )
    })
  const pinch = Gesture.Pinch()
    .enabled(interactive && !!onPinch)
    .onEnd((e) => {
      if (!onPinch) return
      if (e.scale > 1.2) runOnJS(onPinch)(1)
      else if (e.scale < 0.83) runOnJS(onPinch)(-1)
    })

  const selected = drawables.find((d) => d.key === selectedKey)
  const guidePath = useMemo(
    () => (guideTiles ?? []).map(({ col, row }) => diamondPath(frame, col, row, 0, 0.18)).join(""),
    [guideTiles, frame],
  )
  const previewPath = previewTile
    ? diamondPath(frame, previewTile.col, previewTile.row, 0, 0.06)
    : ""
  const sea = bitmapImage(seaTile())

  return (
    <GestureHandlerRootView style={styles.fill}>
      <GestureDetector gesture={Gesture.Race(pinch, Gesture.Exclusive(pan, tap))}>
        <Canvas style={styles.fill} accessibilityLabel={accessibilityLabel}>
          <Group transform={transform} antiAlias={false}>
            {/* Open water continues past the island so wide or tall screens never show a bare edge. */}
            <Rect
              x={-frame.width}
              y={-frame.height}
              width={frame.width * 3}
              height={frame.height * 3}
            >
              <ImageShader
                image={sea}
                tx={repeat}
                ty={repeat}
                rect={{ x: 0, y: 0, width: SEA_TILE.width, height: SEA_TILE.height }}
                sampling={sampling}
              />
            </Rect>
            <Image
              image={bitmapImage(ground)}
              x={0}
              y={0}
              width={frame.width}
              height={frame.height}
              sampling={sampling}
            />
            {glints.map(({ x, y, phase }) => (
              <Glint key={`${x}-${y}`} x={x} y={y} phase={phase} tick={tick} />
            ))}
            {!!guidePath && <Guide path={guidePath} tick={tick} />}
            {!!previewPath && <Guide path={previewPath} tick={tick} strong />}
            {drawables.map((drawable) => (
              <DrawableNode key={drawable.key} drawable={drawable} tick={tick} />
            ))}
            {selected && <Marker x={selected.baseX} top={selected.top} tick={tick} />}
          </Group>
        </Canvas>
      </GestureDetector>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })

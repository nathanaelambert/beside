import { memo, useEffect, useMemo, useRef } from "react"
import { PixelRatio, StyleSheet } from "react-native"
import { Canvas, Group, Image, ImageShader, Path, Rect } from "@shopify/react-native-skia"
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler"
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"

import {
  archipelagoBounds,
  hitTestIslands,
  islandPoint,
  seaProps,
  signScale,
  zoomStops,
  type IslandLayer,
  type SeaProp,
} from "./archipelago"
import { buoy, seaRock } from "./archipelagoProps"
import type { Bitmap } from "./bitmap"
import { recolor } from "./islandPalettes"
import { paintGround, SEA_TILE, seaTile, waterGlints } from "./paint"
import { isoToScreen, type MapFrame } from "./projection"
import { type Drawable, type HitTarget } from "./scene"
import { artImage, bitmapImage, sampling } from "./skia"
import type { TileMap } from "./tilemap"
import { voyagePoint, type VoyagePath } from "./voyage"
import { Boat } from "./VoyageBoat"
import type { Avatar } from "../pixel-world/avatars"

// Kept out of JSX: the i18n test reads quoted tx props as translation keys.
const repeat = "repeat" as const

const grounds = new WeakMap<TileMap, Bitmap>()
function groundFor(map: TileMap, frame: MapFrame, palette = 0) {
  let ground = grounds.get(map)
  if (!ground) grounds.set(map, (ground = paintGround(map, frame)))
  return recolor(ground, palette)
}

/** Rocks sit still; buoys bob between two frames, out of step with each other. */
function SeaPropNode({ prop, tick }: { prop: SeaProp; tick: SharedValue<number> }) {
  const frames = prop.kind === "buoy" ? [buoy(0), buoy(1)] : [seaRock(prop.seed)]
  const phase = Math.floor(prop.seed * 8)
  const up = useDerivedValue(() => (Math.floor((tick.value + phase) / 6) % 2 === 1 ? 1 : 0))
  const down = useDerivedValue(() => 1 - up.value)
  return (
    <>
      {frames.map((sprite, index) => (
        <Image
          key={index}
          image={bitmapImage(sprite.bitmap)}
          x={prop.x - sprite.anchorX}
          y={prop.y - sprite.anchorY}
          width={sprite.bitmap.width}
          height={sprite.bitmap.height}
          sampling={sampling}
          opacity={frames.length === 1 ? 1 : index ? up : down}
        />
      ))}
    </>
  )
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

export interface CanvasVoyage {
  key: string
  path: VoyagePath
  avatar: Avatar
  destination: { x: number; y: number }
  arrivalZoom: number
}

type SceneProps =
  | { islands: IslandLayer[]; map?: never; frame?: never; drawables?: never }
  | { islands?: never; map: TileMap; frame: MapFrame; drawables: Drawable[] }

export type IsoWorldCanvasProps = SceneProps & {
  width: number
  height: number
  /** Points per art pixel; always an integer number of device pixels. */
  zoom: number
  focus: { u: number; v: number }
  focusIslandKey?: string
  resetCamera?: number
  selectedKey?: string
  guideTiles?: { col: number; row: number }[]
  previewTile?: { col: number; row: number }
  interactive?: boolean
  accessibilityLabel?: string
  voyage?: CanvasVoyage
  onArrival?: () => void
  onTap?: (result: { islandKey?: string; hit?: HitTarget; x: number; y: number }) => void
  onPinch?: (direction: 1 | -1) => void
}

function IslandSign({
  sign,
  tick,
  visible,
  zoom,
  ratio,
}: {
  sign: Drawable
  tick: SharedValue<number>
  visible: SharedValue<number>
  zoom: SharedValue<number>
  ratio: number
}) {
  const fixedZoom = signScale(ratio)
  const transform = useDerivedValue(() => [
    { translateX: sign.baseX },
    { translateY: sign.baseY },
    { scale: fixedZoom / zoom.value },
  ])
  const local = useMemo(
    () => ({
      ...sign,
      x: sign.x - sign.baseX,
      y: sign.y - sign.baseY,
      baseX: 0,
      baseY: 0,
      top: sign.top - sign.baseY,
    }),
    [sign],
  )
  return (
    <Group opacity={visible} transform={transform}>
      <DrawableNode drawable={local} tick={tick} />
    </Group>
  )
}

const IslandNodes = memo(function IslandNodes({
  island,
  tick,
  selectedKey,
  guideTiles,
  previewTile,
  signs,
  signZoom,
  ratio,
  focused,
}: {
  island: IslandLayer
  tick: SharedValue<number>
  selectedKey?: string
  guideTiles?: { col: number; row: number }[]
  previewTile?: { col: number; row: number }
  signs: SharedValue<number>
  signZoom: SharedValue<number>
  ratio: number
  focused: boolean
}) {
  const { map, frame, drawables, offset } = island
  // The island you're on shows its sign with the "you are here" pennant.
  const sign = focused ? (island.signHere ?? island.sign) : island.sign
  const ground = groundFor(map, frame, island.palette)
  const glints = useMemo(() => waterGlints(map, frame), [map, frame])
  const guidePath = useMemo(
    () => (guideTiles ?? []).map(({ col, row }) => diamondPath(frame, col, row, 0, 0.18)).join(""),
    [guideTiles, frame],
  )
  const previewPath = previewTile
    ? diamondPath(frame, previewTile.col, previewTile.row, 0, 0.06)
    : ""
  const selected = focused ? drawables.find((d) => d.key === selectedKey) : undefined
  return (
    <Group transform={[{ translateX: offset.x }, { translateY: offset.y }]}>
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
      {sign && <IslandSign sign={sign} tick={tick} visible={signs} zoom={signZoom} ratio={ratio} />}
    </Group>
  )
})

function clampAxis(value: number, viewport: number, min: number, max: number, zoom: number) {
  "worklet"
  const extent = (max - min) * zoom
  return viewport >= extent
    ? (viewport - extent) / 2 - min * zoom
    : Math.min(-min * zoom, Math.max(viewport - max * zoom, value))
}

export function IsoWorldCanvas({
  width,
  height,
  map,
  frame,
  drawables,
  islands: suppliedIslands,
  zoom,
  focus,
  focusIslandKey,
  resetCamera = 0,
  selectedKey,
  guideTiles,
  previewTile,
  interactive = true,
  accessibilityLabel,
  onTap,
  onPinch,
  voyage,
  onArrival,
}: IsoWorldCanvasProps) {
  const islands = useMemo(
    () =>
      suppliedIslands ?? [
        { key: "single", map: map!, frame: frame!, drawables: drawables!, offset: { x: 0, y: 0 } },
      ],
    [suppliedIslands, map, frame, drawables],
  )
  const ordered = useMemo(() => [...islands].sort((a, b) => a.offset.y - b.offset.y), [islands])
  const focused = islands.find((island) => island.key === focusIslandKey) ?? islands[0]!
  const bounds = useMemo(() => archipelagoBounds(islands, islands.length > 1 ? 88 : 0), [islands])
  const ratio = PixelRatio.get()
  const widest = zoomStops(ratio, islands.length > 1)[0]!
  const props = useMemo(() => (islands.length > 1 ? seaProps(islands) : []), [islands])
  const cameraX = useSharedValue(0)
  const cameraY = useSharedValue(0)
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  const tick = useSharedValue(0)
  const progress = useSharedValue(0)
  const departure = useSharedValue({ x: 0, y: 0, zoom })
  const reduceMotion = useReducedMotion()
  const lastZoom = useRef(zoom)
  const destination = islandPoint(focused, focus.u, focus.v)
  const focusX = destination.x
  const focusY = destination.y
  const minX = bounds.x
  const minY = bounds.y
  const maxX = bounds.x + bounds.width
  const maxY = bounds.y + bounds.height

  useEffect(() => {
    if (voyage) return
    cameraX.value = clampAxis(width / 2 - focusX * zoom, width, minX, maxX, zoom)
    cameraY.value = clampAxis(height / 2 - focusY * zoom, height, minY, maxY, zoom)
    lastZoom.current = zoom
    // Zoom is handled separately so manual zoom preserves the viewport's centre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetCamera, width, height, focusX, focusY])

  useEffect(() => {
    const previous = lastZoom.current
    if (previous === zoom || voyage) return
    const cx = (width / 2 - cameraX.value) / previous
    const cy = (height / 2 - cameraY.value) / previous
    cameraX.value = clampAxis(width / 2 - cx * zoom, width, minX, maxX, zoom)
    cameraY.value = clampAxis(height / 2 - cy * zoom, height, minY, maxY, zoom)
    lastZoom.current = zoom
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom])

  useEffect(() => {
    if (!voyage) return
    departure.value = {
      x: (width / 2 - cameraX.value) / zoom,
      y: (height / 2 - cameraY.value) / zoom,
      zoom,
    }
    progress.value = 0
    progress.value = withTiming(1, { duration: 3000, easing: Easing.linear }, (finished) => {
      if (finished && onArrival) runOnJS(onArrival)()
    })
    return () => cancelAnimation(progress)
    // Keep a running voyage independent of viewport renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voyage?.key])

  useEffect(() => {
    if (reduceMotion) return
    const id = setInterval(() => {
      tick.value = tick.value + 1
    }, 125)
    return () => clearInterval(id)
  }, [reduceMotion, tick])

  const boatProgress = useDerivedValue(() =>
    Math.max(0, Math.min(1, (progress.value - 0.14) / 0.72)),
  )
  const camera = useDerivedValue(() => {
    if (!voyage) return { x: cameraX.value, y: cameraY.value, zoom }
    const t = progress.value
    const boat = voyagePoint(voyage.path, boatProgress.value)
    // Step zoom through integer device-pixel scales even while the camera follows the boat.
    const out = Math.min(1, t / 0.14)
    const into = Math.max(0, (t - 0.86) / 0.14)
    const easeOut = 1 - Math.pow(1 - out, 3)
    const easeIn = 1 - Math.pow(1 - into, 3)
    const wide = widest
    const raw =
      t < 0.14
        ? departure.value.zoom + (wide - departure.value.zoom) * easeOut
        : wide + (voyage.arrivalZoom - wide) * easeIn
    // Whole device pixels per art pixel where the screen can; low-density screens go below one.
    const scale = raw * ratio >= 1 ? Math.round(raw * ratio) / ratio : raw
    const x =
      t < 0.14
        ? departure.value.x + (boat.x - departure.value.x) * easeOut
        : boat.x + (voyage.destination.x - boat.x) * easeIn
    const y =
      t < 0.14
        ? departure.value.y + (boat.y - departure.value.y) * easeOut
        : boat.y + (voyage.destination.y - boat.y) * easeIn
    return {
      x: clampAxis(width / 2 - x * scale, width, minX, maxX, scale),
      y: clampAxis(height / 2 - y * scale, height, minY, maxY, scale),
      zoom: scale,
    }
  })
  const transform = useDerivedValue(() => [
    { translateX: Math.round(camera.value.x * ratio) / ratio },
    { translateY: Math.round(camera.value.y * ratio) / ratio },
    { scale: camera.value.zoom },
  ])
  const signZoom = useDerivedValue(() => camera.value.zoom)
  const signs = useDerivedValue<number>(() => (camera.value.zoom <= 1 ? 1 : 0))
  const enabled = interactive && !voyage
  const pan = Gesture.Pan()
    .minDistance(8)
    .enabled(enabled)
    .onStart(() => {
      startX.value = cameraX.value
      startY.value = cameraY.value
    })
    .onUpdate((e) => {
      cameraX.value = clampAxis(startX.value + e.translationX, width, minX, maxX, zoom)
      cameraY.value = clampAxis(startY.value + e.translationY, height, minY, maxY, zoom)
    })
  const handleTap = (x: number, y: number) =>
    onTap?.(hitTestIslands(islands, { x, y }, 44 / zoom, zoom <= 1, signScale(ratio) / zoom))
  const tap = Gesture.Tap()
    .maxDistance(8)
    .enabled(enabled)
    .onEnd((e, success) => {
      if (success)
        runOnJS(handleTap)(
          (e.x - Math.round(cameraX.value * ratio) / ratio) / zoom,
          (e.y - Math.round(cameraY.value * ratio) / ratio) / zoom,
        )
    })
  const pinch = Gesture.Pinch()
    .enabled(enabled && !!onPinch)
    .onEnd((e) => {
      if (!onPinch) return
      if (e.scale > 1.2) runOnJS(onPinch)(1)
      else if (e.scale < 0.83) runOnJS(onPinch)(-1)
    })
  const sea = bitmapImage(seaTile())
  // Cover even very wide viewports at the minimum device-pixel zoom.
  const seaMargin = Math.max(width, height) * ratio + 128
  return (
    <GestureHandlerRootView style={styles.fill}>
      <GestureDetector gesture={Gesture.Race(pinch, Gesture.Exclusive(pan, tap))}>
        <Canvas style={styles.fill} accessibilityLabel={accessibilityLabel}>
          <Group transform={transform} antiAlias={false}>
            <Rect
              x={minX - seaMargin}
              y={minY - seaMargin}
              width={bounds.width + seaMargin * 2}
              height={bounds.height + seaMargin * 2}
            >
              <ImageShader
                image={sea}
                tx={repeat}
                ty={repeat}
                rect={{ x: 0, y: 0, width: SEA_TILE.width, height: SEA_TILE.height }}
                sampling={sampling}
              />
            </Rect>
            {props.map((prop) => (
              <SeaPropNode key={prop.key} prop={prop} tick={tick} />
            ))}
            {ordered.map((island) => (
              <IslandNodes
                key={island.key}
                island={island}
                tick={tick}
                focused={island.key === focused.key}
                selectedKey={selectedKey}
                guideTiles={island.key === focused.key ? guideTiles : undefined}
                previewTile={island.key === focused.key ? previewTile : undefined}
                signs={signs}
                signZoom={signZoom}
                ratio={ratio}
              />
            ))}
            {voyage && <Boat path={voyage.path} progress={boatProgress} avatar={voyage.avatar} />}
          </Group>
        </Canvas>
      </GestureDetector>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })

import { memo, useEffect } from "react"
import { StyleSheet } from "react-native"
import type { PixelArt } from "@beside/rewards"
import {
  AlphaType,
  Canvas,
  ColorType,
  FilterMode,
  Group,
  Image,
  ImageShader,
  MipmapMode,
  Path,
  Rect,
  Skia,
  type SkImage,
} from "@shopify/react-native-skia"
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler"
import {
  runOnJS,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated"

import { AVATAR_HEIGHT, AVATAR_WIDTH, avatars, type Avatar } from "./avatars"
import { catalogue, footprint, WORLD_HEIGHT, WORLD_WIDTH, type WorldItem } from "./scene"
import { getTerrain, getWoodsTile, WOODS_TILE } from "./terrain"

// Everything is a bitmap at one texel per world pixel, scaled by an integer with nearest
// sampling. No interpolation, no antialiasing, and only one draw per sprite.
const sampling = { filter: FilterMode.Nearest, mipmap: MipmapMode.None }
// Kept out of JSX: the i18n test reads quoted tx props as translation keys.
const tile = "repeat" as const

function makeImage(width: number, height: number, rgba: Uint8Array) {
  // Alpha is only ever 0 or 255, so premultiplied and straight alpha are identical.
  return Skia.Image.MakeImage(
    { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Premul },
    Skia.Data.fromBytes(rgba),
    width * 4,
  )
}

const images = new Map<PixelArt, SkImage | null>()
function artImage(art: PixelArt) {
  let image = images.get(art)
  if (image === undefined) {
    const width = art.pixels[0].length
    const rgba = new Uint8Array(width * art.pixels.length * 4)
    art.pixels.forEach((row, y) =>
      [...row].forEach((key, x) => {
        if (key === ".") return
        const hex = art.palette[key]
        const i = (y * width + x) * 4
        rgba[i] = parseInt(hex.slice(1, 3), 16)
        rgba[i + 1] = parseInt(hex.slice(3, 5), 16)
        rgba[i + 2] = parseInt(hex.slice(5, 7), 16)
        rgba[i + 3] = 255
      }),
    )
    image = makeImage(width, art.pixels.length, rgba)
    images.set(art, image)
  }
  return image
}

let woodsImage: SkImage | null | undefined
function getWoodsImage() {
  if (woodsImage === undefined) woodsImage = makeImage(WOODS_TILE, WOODS_TILE, getWoodsTile())
  return woodsImage
}

let terrainImage: SkImage | null | undefined
function getTerrainImage() {
  if (terrainImage === undefined)
    terrainImage = makeImage(WORLD_WIDTH, WORLD_HEIGHT, getTerrain().rgba)
  return terrainImage
}

// A stepped, pixel-exact ellipse, centred on (0, 0).
function ellipsePath(width: number, height: number) {
  const rx = width / 2
  const ry = height / 2
  let d = ""
  for (let y = 0; y < height; y++) {
    const dy = (y + 0.5 - ry) / ry
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - dy * dy)))
    if (half > 0) d += `M${-half} ${y - Math.floor(ry)}h${half * 2}v1h${-half * 2}z`
  }
  return d
}
const shadows = new Map<number, string>()
function shadowPath(width: number) {
  if (!shadows.has(width)) shadows.set(width, ellipsePath(width + 4, 4))
  return shadows.get(width)!
}
const spriteFootprints = new Map(
  [...catalogue].map(([id, item]) => [id, footprint(item.artifact)] as const),
)

// Downward pointer above the selection, cream with a dark outline.
const pointerFill = "M-2 0h5v1h-1v1h-1v1h-1v-1h-1v-1h-1z"
const pointerOutline =
  "M-3 -1h7v1h-7zM-3 0h1v1h-1zM3 0h1v1h-1zM-2 1h1v1h-1zM2 1h1v1h-1zM-1 2h1v1h-1zM1 2h1v1h-1zM0 3h1v1h-1z"

// Filled corner brackets around a placement preview.
function bracketPath({ x, y }: WorldItem) {
  const l = x - 19
  const r = x + 18
  const t = y - 35
  const b = y + 5
  return (
    `M${l} ${t}h8v1h-7v7h-1z M${r - 7} ${t}h8v8h-1v-7h-7z` +
    `M${l} ${b - 7}h1v7h7v1h-8z M${r} ${b - 7}h1v8h-8v-1h7z`
  )
}

const glints = [
  [216, 133, 0],
  [236, 144, 3],
  [212, 160, 5],
  [242, 162, 2],
]

const Shadow = memo(function Shadow({ x, y, width }: { x: number; y: number; width: number }) {
  return (
    <Group transform={[{ translateX: x }, { translateY: y }]}>
      <Path path={shadowPath(width)} color="rgba(30, 52, 34, 0.3)" antiAlias={false} />
    </Group>
  )
})

const SkiaSprite = memo(function SkiaSprite({
  itemId,
  x,
  y,
  opacity = 1,
}: {
  itemId: string
  x: number
  y: number
  opacity?: number
}) {
  const item = catalogue.get(itemId)
  const box = spriteFootprints.get(itemId)
  if (!item || !box) return null
  return (
    <Group opacity={opacity}>
      <Shadow
        x={x - 16 + Math.floor((box.left + box.right + 1) / 2)}
        y={y - 32 + box.bottom}
        width={box.right - box.left + 1}
      />
      <Image
        image={artImage(item.artifact)}
        x={x - 16}
        y={y - 32}
        width={32}
        height={32}
        sampling={sampling}
      />
    </Group>
  )
})

function AvatarSprite({ avatar, tick }: { avatar: Avatar; tick: SharedValue<number> }) {
  // Breathe for a beat every two seconds; blink now and then. Discrete frames, never tweened.
  const frame = useDerivedValue(() => {
    const t = tick.value + avatar.phase
    if (t % 23 === 0 || t % 41 === 0) return 1
    return Math.floor(t / 8) % 2 === 1 ? 2 : 0
  })
  const idle = useDerivedValue(() => (frame.value === 0 ? 1 : 0))
  const blink = useDerivedValue(() => (frame.value === 1 ? 1 : 0))
  const breathe = useDerivedValue(() => (frame.value === 2 ? 1 : 0))
  const x = avatar.x - AVATAR_WIDTH / 2
  const y = avatar.y - AVATAR_HEIGHT
  const props = { x, y, width: AVATAR_WIDTH, height: AVATAR_HEIGHT, sampling }
  return (
    <Group>
      <Shadow x={avatar.x} y={avatar.y - 1} width={11} />
      <Image image={artImage(avatar.frames.idle)} opacity={idle} {...props} />
      <Image image={artImage(avatar.frames.blink)} opacity={blink} {...props} />
      <Image image={artImage(avatar.frames.breathe)} opacity={breathe} {...props} />
    </Group>
  )
}

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
  return <Rect x={x} y={y} width={2} height={1} color="#e9f6ec" opacity={opacity} />
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

export interface WorldCanvasProps {
  width: number
  height: number
  items: WorldItem[]
  selectedKey?: string
  preview?: WorldItem
  resetCamera: number
  onTap: (x: number, y: number, scale: number) => void
}

export function WorldCanvas({
  width,
  height,
  items,
  selectedKey,
  preview,
  resetCamera,
  onTap,
}: WorldCanvasProps) {
  // Opening the tray changes height, so derive zoom from width to keep pixels the same size.
  const scale = Math.max(1, Math.floor(width / 176))
  const cameraX = useSharedValue(0)
  const cameraY = useSharedValue(0)
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  const tick = useSharedValue(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    cameraX.value = Math.round((width - WORLD_WIDTH * scale) / 2)
    cameraY.value = Math.round((height - WORLD_HEIGHT * scale) / 2)
  }, [width, height, scale, resetCamera, cameraX, cameraY])

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
    { scale },
  ])
  const pan = Gesture.Pan()
    .minDistance(8)
    .onStart(() => {
      startX.value = cameraX.value
      startY.value = cameraY.value
    })
    .onUpdate((e) => {
      cameraX.value =
        width >= WORLD_WIDTH * scale
          ? Math.round((width - WORLD_WIDTH * scale) / 2)
          : Math.min(0, Math.max(width - WORLD_WIDTH * scale, startX.value + e.translationX))
      cameraY.value =
        height >= WORLD_HEIGHT * scale
          ? Math.round((height - WORLD_HEIGHT * scale) / 2)
          : Math.min(0, Math.max(height - WORLD_HEIGHT * scale, startY.value + e.translationY))
    })
  const tap = Gesture.Tap()
    .maxDistance(8)
    .onEnd((e, success) => {
      if (success)
        runOnJS(onTap)(
          (e.x - Math.round(cameraX.value)) / scale,
          (e.y - Math.round(cameraY.value)) / scale,
          scale,
        )
    })

  const selectedAvatar = avatars.find((a) => a.key === selectedKey)
  const selectedItem = preview ? undefined : items.find((item) => item.key === selectedKey)
  const marker = selectedAvatar
    ? { x: selectedAvatar.x, top: selectedAvatar.y - AVATAR_HEIGHT }
    : selectedItem && {
        x: selectedItem.x,
        top: selectedItem.y - 32 + (spriteFootprints.get(selectedItem.itemId)?.top ?? 0),
      }

  const drawables = [
    ...items.map((item) => ({
      y: item.y,
      key: item.key,
      node: <SkiaSprite itemId={item.itemId} x={item.x} y={item.y} />,
    })),
    ...avatars.map((avatar) => ({
      y: avatar.y,
      key: avatar.key,
      node: <AvatarSprite avatar={avatar} tick={tick} />,
    })),
    ...(preview
      ? [
          {
            y: preview.y,
            key: "preview",
            node: <SkiaSprite itemId={preview.itemId} x={preview.x} y={preview.y} opacity={0.7} />,
          },
        ]
      : []),
  ].sort((a, b) => a.y - b.y)

  return (
    <GestureHandlerRootView style={styles.fill}>
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <Canvas
          style={styles.fill}
          accessibilityLabel="Pixel meadow ringed by woods, with a pond and dock, two friends on a picnic blanket, and catalogue decorations. Drag to explore; tap an item to inspect it."
        >
          <Group transform={transform} antiAlias={false}>
            {/* Forest continues past the world, so tall or wide screens never show a bare edge. */}
            <Rect
              x={-WORLD_WIDTH}
              y={-WORLD_HEIGHT}
              width={WORLD_WIDTH * 3}
              height={WORLD_HEIGHT * 3}
            >
              <ImageShader
                image={getWoodsImage()}
                tx={tile}
                ty={tile}
                rect={{ x: 0, y: 0, width: WOODS_TILE, height: WOODS_TILE }}
                sampling={sampling}
              />
            </Rect>
            <Image
              image={getTerrainImage()}
              x={0}
              y={0}
              width={WORLD_WIDTH}
              height={WORLD_HEIGHT}
              sampling={sampling}
            />
            {glints.map(([x, y, phase]) => (
              <Glint key={`${x}-${y}`} x={x} y={y} phase={phase} tick={tick} />
            ))}
            {drawables.map(({ key, node }) => (
              <Group key={key}>{node}</Group>
            ))}
            {preview && <Path path={bracketPath(preview)} color="#fff4cf" antiAlias={false} />}
            {marker && <Marker x={marker.x} top={marker.top} tick={tick} />}
          </Group>
        </Canvas>
      </GestureDetector>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })

import { memo, useEffect } from "react"
import { StyleSheet } from "react-native"
import { pixelPaths } from "@beside/rewards/pixel-art"
import { Canvas, Group, Path, Rect } from "@shopify/react-native-skia"
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler"
import { runOnJS, useDerivedValue, useSharedValue } from "react-native-reanimated"

import { catalogue, WORLD_HEIGHT, WORLD_WIDTH, type WorldItem } from "./scene"

// Convert the shared catalogue once. Paths stay on integer coordinates; no bitmap interpolation.
const sprites = new Map([...catalogue].map(([id, item]) => [id, pixelPaths(item.artifact)]))
const grass = Array.from({ length: 240 }, (_, i) => ({
  x: (i * 73 + 19) % WORLD_WIDTH,
  y: (i * 47 + 13) % WORLD_HEIGHT,
}))
const flowers = [
  [48, 105],
  [99, 188],
  [164, 76],
  [235, 179],
  [122, 160],
  [203, 72],
]

export const SkiaSprite = memo(function SkiaSprite({
  itemId,
  x,
  y,
}: {
  itemId: string
  x: number
  y: number
}) {
  return (
    <Group transform={[{ translateX: x - 16 }, { translateY: y - 32 }]}>
      {sprites.get(itemId)?.map(({ fill, d }) => (
        <Path key={fill} path={d} color={fill} antiAlias={false} />
      ))}
    </Group>
  )
})

const Scenery = memo(function Scenery() {
  return (
    <Group antiAlias={false}>
      <Rect x={0} y={0} width={WORLD_WIDTH} height={WORLD_HEIGHT} color="#92af70" />
      <Path path="M48 40h184v16h24v144h-24v24H56v-16H32V72h16z" color="#acc786" />
      <Path path="M88 80h104v16h24v88h-24v24H88v-16H64v-80h24z" color="#b5ce90" />
      {grass.map(({ x, y }, i) => (
        <Rect
          key={i}
          x={x}
          y={y}
          width={i % 3 === 0 ? 3 : 1}
          height={1}
          color={i % 2 ? "#9fbb7b" : "#bfd398"}
        />
      ))}
      {/* A stepped dirt path, pond bank, shallow water, and a little wooden bridge. */}
      <Path path="M128 240v-48h-8v-32h8v-40h16v48h-8v24h8v48z" color="#d5be8b" />
      <Path path="M132 240v-44h-8v-32h8v-36h4v44h-8v20h8v48z" color="#e1cea2" />
      <Path
        path="M200 108h32v8h16v16h8v24h-8v16h-16v8h-32v-8h-16v-16h-8v-24h8v-16h16z"
        color="#789966"
      />
      <Path path="M200 116h32v8h12v12h4v20h-12v12h-36v-8h-16v-24h8v-12h8z" color="#75aaa2" />
      <Path path="M200 124h32v8h8v16h-12v12h-24v-8h-12v-16h8z" color="#89bdb0" />
      <Path path="M206 128h12v2h-12zM228 146h10v2h-10zM196 148h8v2h-8z" color="#c2d7be" />
      <Rect x={174} y={138} width={36} height={18} color="#795e43" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Rect key={i} x={175 + i * 6} y={139} width={5} height={14} color="#bd9563" />
      ))}
      <Path path="M174 135h36v3h-36zM174 155h36v3h-36z" color="#8e704c" />
      <Path path="M228 130h8v5h-8zM224 132h6v3h-6z" color="#527c54" />
      <Rect x={230} y={128} width={3} height={3} color="#edbdad" />
      {flowers.map(([x, y]) => (
        <Group key={`${x}-${y}`}>
          <Rect x={x} y={y} width={1} height={4} color="#6b925e" />
          <Rect x={x - 1} y={y - 1} width={3} height={2} color="#f4dfad" />
          <Rect x={x} y={y - 1} width={1} height={1} color="#c89b65" />
        </Group>
      ))}
      {/* Two quiet, handmade avatar silhouettes. No movement required. */}
      <Path
        path="M146 132h8v6h-8zM144 138h12v10h-12zM145 148h4v5h-4zM151 148h4v5h-4z"
        color="#655c51"
      />
      <Rect x={147} y={134} width={6} height={5} color="#deb58a" />
      <Rect x={144} y={139} width={12} height={8} color="#c57c72" />
      <Path
        path="M160 114h8v6h-8zM158 120h12v10h-12zM159 130h4v4h-4zM165 130h4v4h-4z"
        color="#554e43"
      />
      <Rect x={161} y={116} width={6} height={5} color="#c89571" />
      <Rect x={158} y={121} width={12} height={8} color="#6c8e9c" />
    </Group>
  )
})

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

  useEffect(() => {
    cameraX.value = Math.round((width - WORLD_WIDTH * scale) / 2)
    cameraY.value = Math.round((height - WORLD_HEIGHT * scale) / 2)
  }, [width, height, scale, resetCamera, cameraX, cameraY])

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
  const selection = preview ?? items.find((item) => item.key === selectedKey)

  return (
    <GestureHandlerRootView style={styles.fill}>
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <Canvas
          style={styles.fill}
          accessibilityLabel="Pixel meadow with a pond, bridge, two friends, and catalogue decorations. Drag to explore; tap an item to inspect it."
        >
          <Group transform={transform} antiAlias={false}>
            <Scenery />
            {selection && (
              <Rect
                x={selection.x - 18}
                y={selection.y - 8}
                width={36}
                height={12}
                color={preview ? "#f5e5b7" : "#e3eac1"}
              />
            )}
            {[...items, ...(preview ? [preview] : [])]
              .sort((a, b) => a.y - b.y)
              .map((item) => (
                <Group key={item.key} opacity={item.key === "preview" ? 0.65 : 1}>
                  <Rect x={item.x - 10} y={item.y - 3} width={20} height={3} color="#76945f" />
                  <SkiaSprite itemId={item.itemId} x={item.x} y={item.y} />
                </Group>
              ))}
            {preview && (
              <Path
                path={`M${preview.x - 18} ${preview.y - 26}v-8h8M${preview.x + 10} ${preview.y - 34}h8v8M${preview.x - 18} ${preview.y - 2}v8h8M${preview.x + 10} ${preview.y + 6}h8v-8`}
                style="stroke"
                strokeWidth={1}
                color="#486443"
              />
            )}
          </Group>
        </Canvas>
      </GestureDetector>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })

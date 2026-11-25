import { Pressable, StyleSheet } from "react-native"
import type { PixelArt } from "@beside/rewards"
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated"

import { PixelArtSprite } from "@/components/BesideMark"
import { Text } from "@/components/Text"
import { world, worldShape } from "@/theme/world"

const width = 132
const height = worldShape.control
const margin = 8
const gap = 9
const tailWidth = 12
const tailHeight = 8

const tail: PixelArt = {
  format: "pixel-art",
  palette: { o: world.outline, p: world.paper },
  pixels: [
    "oppppppppppo",
    "oppppppppppo",
    ".oppppppppo.",
    "..oppppppo..",
    "...oppppo...",
    "....oppo....",
    ".....oo.....",
    "............",
  ],
}

const pencil: PixelArt = {
  format: "pixel-art",
  palette: { o: world.outline, g: world.leaf, p: world.paper },
  pixels: [
    "......oo",
    ".....ogo",
    "....ogog",
    "...ogoo.",
    "..ogo...",
    ".ogo....",
    "opo.....",
    "oo......",
  ],
}

const footsteps: PixelArt = {
  format: "pixel-art",
  palette: { o: world.outline, g: world.leaf, p: world.paper },
  pixels: [
    "....ooo.",
    "...oggo.",
    "...oggo.",
    "oo..oo..",
    "ogo.....",
    "ogoo....",
    ".ogo....",
    "..oo....",
  ],
}

/** Keep the arrow on the avatar when the card is forced away from a viewport edge. */
export function avatarEditPopupPlacement(
  x: number,
  top: number,
  bottom: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  "worklet"
  const visible =
    viewportWidth >= width + margin * 2 &&
    viewportHeight >= height + margin * 2 &&
    x >= 0 &&
    x <= viewportWidth &&
    bottom >= 0 &&
    top <= viewportHeight
  const left = Math.max(margin, Math.min(viewportWidth - margin - width, Math.round(x - width / 2)))
  const above =
    top - gap - height >= margin ||
    (bottom + gap + height > viewportHeight - margin && top >= viewportHeight - bottom)
  const candidate = above ? top - gap - height : bottom + gap
  const y = Math.max(margin, Math.min(viewportHeight - margin - height, Math.round(candidate)))
  const arrowLeft = Math.max(
    6,
    Math.min(width - tailWidth - 6, Math.round(x - left - tailWidth / 2)),
  )
  return { visible, left, y, above, arrowLeft }
}

export function IslandActionPopup({
  viewport,
  anchor,
  camera,
  ratio,
  action,
  onPress,
}: {
  viewport: { width: number; height: number }
  anchor: { x: number; top: number; bottom: number }
  camera: SharedValue<{ x: number; y: number; zoom: number }>
  ratio: number
  action: "edit-avatar" | "walk"
  onPress: () => void
}) {
  const moving = action === "walk"
  const label = moving ? "Move here" : "Edit avatar"
  const position = useDerivedValue(() => {
    const { x, y, zoom } = camera.value
    const originX = Math.round(x * ratio) / ratio
    const originY = Math.round(y * ratio) / ratio
    return avatarEditPopupPlacement(
      originX + anchor.x * zoom,
      originY + anchor.top * zoom,
      originY + anchor.bottom * zoom,
      viewport.width,
      viewport.height,
    )
  })
  const cardStyle = useAnimatedStyle(() => ({
    display: position.value.visible ? "flex" : "none",
    left: position.value.left,
    top: position.value.y,
  }))
  const tailStyle = useAnimatedStyle(() => ({
    left: position.value.arrowLeft,
    top: position.value.above ? height - 2 : 2 - tailHeight,
    transform: [{ scaleY: position.value.above ? 1 : -1 }],
  }))
  return (
    <Animated.View
      pointerEvents="box-none"
      testID={moving ? "lawn-walk-popup" : "avatar-edit-popup"}
      style={[styles.root, cardStyle]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={moving ? "homebase-walk-here" : "homebase-edit-avatar"}
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <PixelArtSprite art={moving ? footsteps : pencil} scale={2} />
        <Text text={label} weight="semiBold" style={styles.label} />
      </Pressable>
      <Animated.View pointerEvents="none" style={[styles.tail, tailStyle]}>
        <PixelArtSprite art={tail} scale={1} />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: world.paper,
    borderColor: world.outline,
    borderWidth: 2,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  label: { color: world.ink, fontSize: 14, lineHeight: 20 },
  pressed: { backgroundColor: world.meadow },
  root: { height, position: "absolute", width, zIndex: 3 },
  tail: { position: "absolute" },
})

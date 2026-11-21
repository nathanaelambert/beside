import { Group, Image, type SkImage } from "@shopify/react-native-skia"
import { useDerivedValue, type SharedValue } from "react-native-reanimated"

import { foliageBands, foliageGust, foliagePhase, type FoliageKind } from "./foliageWind"
import type { Drawable } from "./scene"
import { sampling } from "./skia"

type SpriteBounds = Pick<Drawable, "x" | "y" | "width" | "height" | "top" | "baseX" | "baseY">

/** Move only the upper strips of the original texture, with no resampling or moving shadow. */
export function FoliageSprite({
  drawable,
  kind,
  image,
  tick,
}: {
  drawable: SpriteBounds
  kind: FoliageKind
  image: SkImage | null
  tick: SharedValue<number>
}) {
  const { x, y, width, height } = drawable
  const phase = foliagePhase(drawable.baseX, drawable.baseY)
  const { canopy, root, tipTravel } = foliageBands(drawable, kind)
  const tipX = useDerivedValue(() => x + foliageGust(tick.value, phase) * tipTravel)
  const branchX = useDerivedValue(() => x + foliageGust(tick.value, phase))
  const props = { image, y, width, height, sampling }
  // Widen the clip horizontally so the leaning edge never gets cropped.
  const clip = (from: number, to: number) => ({
    x: x - tipTravel,
    y: from,
    width: width + tipTravel * 2,
    height: to - from,
  })
  return (
    <>
      {canopy > y && (
        <Group clip={clip(y, canopy)}>
          <Image x={tipX} {...props} />
        </Group>
      )}
      {root > canopy && (
        <Group clip={clip(canopy, root)}>
          <Image x={branchX} {...props} />
        </Group>
      )}
      <Group clip={clip(root, y + height)}>
        <Image x={x} {...props} />
      </Group>
    </>
  )
}

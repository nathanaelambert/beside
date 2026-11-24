import { Group, Image } from "@shopify/react-native-skia"
import { useDerivedValue, type SharedValue } from "react-native-reanimated"

import { BOAT_SEAT, rowboat, rowboatFront, type Heading } from "./archipelagoProps"
import { bitmapImage, artImage, sampling } from "./skia"
import { voyagePoint, type VoyagePath } from "./voyage"
import { detailedSpriteBitmap } from "./worldDetailArt"
import { AVATAR_HEIGHT, AVATAR_WIDTH, type Avatar } from "../pixel-world/avatars"

const headings: Heading[] = ["se", "sw", "ne", "nw"]

function Hull({
  heading,
  activeHeading,
  progress,
  front = false,
  detailed,
}: {
  heading: Heading
  activeHeading: SharedValue<Heading>
  progress: SharedValue<number>
  front?: boolean
  detailed: boolean
}) {
  const first = useDerivedValue(() =>
    activeHeading.value === heading && Math.floor(progress.value * 18) % 2 === 0 ? 1 : 0,
  )
  const second = useDerivedValue(() =>
    activeHeading.value === heading && Math.floor(progress.value * 18) % 2 === 1 ? 1 : 0,
  )
  const boats = [0, 1].map((frame) =>
    (front ? rowboatFront : rowboat)(frame as 0 | 1, heading, detailed),
  )
  return (
    <>
      {boats.map((boat, index) => (
        <Image
          key={index}
          image={bitmapImage(detailed ? detailedSpriteBitmap(boat.bitmap, "boat") : boat.bitmap)}
          x={-boat.anchorX}
          y={-boat.anchorY}
          width={boat.bitmap.width}
          height={boat.bitmap.height}
          sampling={sampling}
          opacity={index ? second : first}
        />
      ))}
    </>
  )
}

export function Boat({
  path,
  progress,
  avatar,
  detailed = false,
}: {
  path: VoyagePath
  progress: SharedValue<number>
  avatar: Avatar
  detailed?: boolean
}) {
  const point = useDerivedValue(() => voyagePoint(path, progress.value))
  const heading = useDerivedValue<Heading>(() => {
    const before = voyagePoint(path, Math.max(0, progress.value - 0.006))
    const after = voyagePoint(path, Math.min(1, progress.value + 0.006))
    const dx = after.x - before.x
    const dy = after.y - before.y
    return dy >= 0 ? (dx >= 0 ? "se" : "sw") : dx >= 0 ? "ne" : "nw"
  })
  const transform = useDerivedValue(() => [
    { translateX: point.value.x },
    { translateY: point.value.y },
  ])
  return (
    <Group transform={transform}>
      {headings.map((direction) => (
        <Hull
          key={direction}
          heading={direction}
          activeHeading={heading}
          progress={progress}
          detailed={detailed}
        />
      ))}
      <Image
        image={artImage(avatar.frames.idle)}
        x={BOAT_SEAT.x - AVATAR_WIDTH / 2}
        y={BOAT_SEAT.y - AVATAR_HEIGHT + 1}
        width={AVATAR_WIDTH}
        height={AVATAR_HEIGHT}
        sampling={sampling}
      />
      {headings.map((direction) => (
        <Hull
          key={direction}
          heading={direction}
          activeHeading={heading}
          progress={progress}
          detailed={detailed}
          front
        />
      ))}
    </Group>
  )
}

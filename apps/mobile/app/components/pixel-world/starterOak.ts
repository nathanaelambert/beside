import { starterOakItemId, type MeadowPoint } from "@beside/api-client/garden"

export function oakAt({ x, y }: MeadowPoint, key = "starter-oak") {
  return { key, itemId: starterOakItemId, x, y }
}

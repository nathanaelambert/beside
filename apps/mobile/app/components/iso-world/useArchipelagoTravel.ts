import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "@react-navigation/native"
import { useReducedMotion } from "react-native-reanimated"

import { islandPoint, type IslandLayer } from "./archipelago"
import { MOORING, SEA_LIFT } from "./archipelagoProps"
import { homeFocus } from "./homeWorld"
import type { CanvasVoyage } from "./IsoWorldCanvas"
import { voyagePath } from "./voyage"
import type { Avatar } from "../pixel-world/avatars"

export function useArchipelagoTravel({
  layers,
  focusedId,
  avatar,
  arrivalZoom,
  onArrive,
}: {
  layers: IslandLayer[]
  focusedId?: string
  avatar?: Avatar
  arrivalZoom: number
  onArrive: (id: string) => void
}) {
  const [voyage, setVoyage] = useState<CanvasVoyage>()
  const target = useRef<string | undefined>(undefined)
  const reducedMotion = useReducedMotion()
  const sequence = useRef(0)
  const arrive = useCallback(() => {
    const id = target.current
    target.current = undefined
    setVoyage(undefined)
    if (id) onArrive(id)
  }, [onArrive])
  useFocusEffect(
    useCallback(
      () => () => {
        target.current = undefined
        setVoyage(undefined)
      },
      [],
    ),
  )
  const travel = (id: string) => {
    if (target.current || id === focusedId) return false
    const from = layers.find((layer) => layer.key === focusedId)
    const to = layers.find((layer) => layer.key === id)
    if (!from || !to) return false
    if (reducedMotion || !avatar) {
      onArrive(id)
      return true
    }
    target.current = id
    sequence.current++
    setVoyage({
      key: `${id}-${sequence.current}`,
      path: voyagePath(from, to, layers, { ...MOORING, lift: SEA_LIFT }),
      avatar,
      destination: islandPoint(to, homeFocus.u, homeFocus.v),
      arrivalZoom,
    })
    return true
  }
  return { voyage, travel, arrive }
}

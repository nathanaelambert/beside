import { useCallback, useRef, useState } from "react"
import type { MeadowPoint } from "@beside/api-client/garden"
import { useFocusEffect } from "@react-navigation/native"
import { useReducedMotion } from "react-native-reanimated"

const speed = 110 // meadow pixels per second

export function useLawnWalk(homebaseId?: string) {
  const [position, setPosition] = useState<{ homebaseId: string | undefined; feet: MeadowPoint }>()
  const feet = position?.homebaseId === homebaseId ? position?.feet : undefined
  const [walking, setWalking] = useState(false)
  const frame = useRef<number | undefined>(undefined)
  const reducedMotion = useReducedMotion()

  useFocusEffect(
    useCallback(() => {
      if (!homebaseId) return
      return () => {
        if (frame.current !== undefined) cancelAnimationFrame(frame.current)
        frame.current = undefined
        setWalking(false)
      }
    }, [homebaseId]),
  )

  function walk(route: readonly MeadowPoint[]) {
    const setFeet = (feet: MeadowPoint) => setPosition({ homebaseId, feet })
    const goal = route.at(-1)
    if (!goal || frame.current !== undefined) return
    if (reducedMotion) {
      setFeet(goal)
      return
    }
    const lengths = route.slice(1).map((point, i) => {
      const last = route[i]!
      return Math.hypot(point.x - last.x, point.y - last.y)
    })
    const started = performance.now()
    let lastDraw = started - 60
    setWalking(true)
    const advance = () => {
      const now = performance.now()
      let remaining = ((now - started) * speed) / 1000
      let i = 0
      while (i < lengths.length && remaining >= lengths[i]!) remaining -= lengths[i++]!
      if (i === lengths.length) {
        frame.current = undefined
        setFeet(goal)
        setWalking(false)
        return
      }
      // Keep the render pixel-stepped without rebuilding the whole map every frame.
      if (now - lastDraw >= 50) {
        lastDraw = now
        const a = route[i]!
        const b = route[i + 1]!
        const t = remaining / lengths[i]!
        setFeet({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
      }
      frame.current = requestAnimationFrame(advance)
    }
    frame.current = requestAnimationFrame(advance)
  }

  return { feet, walking, walk }
}

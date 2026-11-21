import { useEffect, useState } from "react"
import { cottageConstruction, type ApiState } from "@beside/api-client"

import { estimateServerNow } from "@/services/api/attendance"

/** Tick only during construction or when a planted specimen is still growing. */
export function useCottageClock(
  activities: ApiState["activities"] | undefined,
  serverTime: string | undefined,
  receivedAt: number | undefined,
  gardenDeadline = 0,
) {
  const [tick, setTick] = useState(0)
  const serverNow = Date.parse(serverTime ?? "")
  const now =
    Number.isFinite(serverNow) && receivedAt !== undefined
      ? estimateServerNow(serverNow, receivedAt, tick)
      : Date.now()
  const building =
    activities?.some((activity) => cottageConstruction(activity, now).building) ?? false
  const period = building ? 250 : now < gardenDeadline ? 1000 : 0
  useEffect(() => {
    if (!period) return
    setTick(performance.now())
    const timer = setInterval(() => setTick(performance.now()), period)
    return () => clearInterval(timer)
  }, [period, receivedAt])
  return now
}

import { useEffect, useState } from "react"
import { cottageConstruction, type ApiState } from "@beside/api-client"

import { estimateServerNow } from "@/services/api/attendance"

/** Tick only while at least one visible build is in progress. */
export function useCottageClock(
  activities: ApiState["activities"] | undefined,
  serverTime: string | undefined,
  receivedAt: number | undefined,
) {
  const [tick, setTick] = useState(0)
  const serverNow = Date.parse(serverTime ?? "")
  const now =
    Number.isFinite(serverNow) && receivedAt !== undefined
      ? estimateServerNow(serverNow, receivedAt, tick)
      : Date.now()
  const running =
    activities?.some((activity) => cottageConstruction(activity, now).building) ?? false
  useEffect(() => {
    if (!running) return
    setTick(performance.now())
    const timer = setInterval(() => setTick(performance.now()), 250)
    return () => clearInterval(timer)
  }, [running, receivedAt])
  return now
}

import { useEffect, useState } from "react"

export function useRewardCountdown(deadline: number | undefined, visible: boolean) {
  const [snapshot, setSnapshot] = useState<{ deadline: number; seconds: number }>()
  useEffect(() => {
    if (!visible || deadline === undefined || !Number.isFinite(deadline)) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      const remaining = Math.max(0, deadline - performance.now())
      const seconds = Math.ceil(remaining / 1000)
      setSnapshot({ deadline, seconds })
      if (remaining > 0) timer = setTimeout(update, Math.ceil(remaining - (seconds - 1) * 1000))
    }
    update()
    return () => clearTimeout(timer)
  }, [deadline, visible])
  if (
    !visible ||
    !snapshot ||
    snapshot.deadline !== deadline ||
    snapshot.deadline <= performance.now()
  )
    return 0
  return snapshot.seconds
}

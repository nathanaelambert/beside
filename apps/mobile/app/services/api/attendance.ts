import type { ApiState } from "@beside/api-client"

import { isWindowOpen } from "../../utils/milestoneSchedule"

type Milestone = ApiState["milestones"][number]

/** Use elapsed monotonic time, not the device's wall clock, after a server snapshot. */
export function estimateServerNow(serverTime: number, receivedAt: number, tick: number) {
  return serverTime + Math.max(0, tick - receivedAt)
}

export function attendanceMilestones(milestones: Milestone[], activityId: string, now: number) {
  const open: Milestone[] = []
  const upcoming: Milestone[] = []
  for (const milestone of milestones) {
    if (milestone.activityId !== activityId || milestone.kind !== "achievement") continue
    if (isWindowOpen(milestone.startAt, milestone.endAt, now)) open.push(milestone)
    else if (!milestone.endAt || Date.parse(milestone.endAt) >= now) upcoming.push(milestone)
  }

  const byStart = (a: Milestone, b: Milestone) =>
    (a.startAt ? Date.parse(a.startAt) : Infinity) -
      (b.startAt ? Date.parse(b.startAt) : Infinity) || a.id.localeCompare(b.id)
  open.sort((a, b) => Date.parse(a.endAt!) - Date.parse(b.endAt!) || byStart(a, b))
  upcoming.sort(byStart)
  return { open, upcoming }
}

/** Attendance is boolean: one successful log completes this occurrence for its author. */
export function attendanceMembers(
  logs: Pick<ApiState["logs"][number], "milestoneId" | "authorUserId" | "isSuccess">[],
  milestoneId: string | undefined,
): Set<string> {
  return new Set(
    logs
      .filter((log) => milestoneId && log.milestoneId === milestoneId && log.isSuccess)
      .map((log) => log.authorUserId),
  )
}

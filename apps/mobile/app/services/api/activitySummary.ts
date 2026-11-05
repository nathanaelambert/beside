import type { MilestoneSchedule } from "@beside/api-client"

import { scheduleSummary } from "@/utils/milestoneSchedule"

export function activityScheduleSummary(schedules: MilestoneSchedule[]): string {
  return schedules.length
    ? schedules.map((schedule) => scheduleSummary(schedule.configuration)).join("\n")
    : "No schedule yet"
}

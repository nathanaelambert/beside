import type { ApiState } from "@beside/api-client"

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

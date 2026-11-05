import type { MilestoneSchedule } from "@beside/api-client"

import { activityScheduleSummary } from "./activitySummary"

it("handles no schedule and summarizes a real configured recurrence", () => {
  expect(activityScheduleSummary([])).toBe("No schedule yet")
  const schedule: MilestoneSchedule = {
    id: "s",
    activityId: "a",
    creatorUserId: "u",
    nextDate: "2026-11-04",
    generatedCount: 1,
    enabled: true,
    createdAt: "2026-11-04T00:00:00Z",
    configuration: {
      name: "Attendance",
      quantity: 1,
      itemId: null,
      timeZone: "America/Toronto",
      startDate: "2026-11-04",
      startTime: "17:00",
      endTime: "00:00",
      endDayOffset: 1,
      recurrence: { frequency: "weekly", interval: 1, weekdays: [3] },
      until: null,
      count: null,
    },
  }
  expect(activityScheduleSummary([schedule])).toBe("Every Wednesday · 5:00 PM – midnight")
  expect(activityScheduleSummary([schedule, schedule]).split("\n")).toHaveLength(2)
})

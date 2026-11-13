import type { ApiState } from "@beside/api-client"

import { attendanceMembers, attendanceMilestones, estimateServerNow } from "./attendance"

it("completes only successful authors for the selected occurrence, once each", () => {
  const logs = [
    { milestoneId: "tonight", authorUserId: "mosaab", isSuccess: false },
    { milestoneId: "tonight", authorUserId: "mosaab", isSuccess: true },
    { milestoneId: "tonight", authorUserId: "mosaab", isSuccess: true },
    { milestoneId: "next-week", authorUserId: "nathanael", isSuccess: true },
    { milestoneId: "tonight", authorUserId: "pritesh", isSuccess: false },
  ]
  expect([...attendanceMembers(logs, "tonight")]).toEqual(["mosaab"])
  expect(attendanceMembers(logs, undefined).size).toBe(0)
  expect(attendanceMembers([], "tonight").size).toBe(0)
})

it("advances server time by elapsed time, without using the device wall clock", () => {
  expect(estimateServerNow(100_000, 500, 1_500)).toBe(101_000)
  expect(estimateServerNow(100_000, 500, 499)).toBe(100_000)
})

it("puts the open window that closes first above upcoming windows", () => {
  const now = Date.parse("2026-11-12T18:00:00.000Z")
  const stamp = (minutes: number) => new Date(now + minutes * 60_000).toISOString()
  const make = (
    id: string,
    start: number,
    end: number,
    extras?: Partial<ApiState["milestones"][number]>,
  ): ApiState["milestones"][number] => ({
    id,
    activityId: "reading",
    parentId: "join-reading",
    name: id,
    kind: "achievement",
    quantity: 1,
    policy: "paced",
    startAt: stamp(start),
    endAt: stamp(end),
    rewardId: null,
    createdAt: stamp(-30),
    ...extras,
  })
  const { open, upcoming } = attendanceMilestones(
    [
      make("open-later-close", -10, 10),
      make("closed", -10, -1),
      make("future", 1, 3),
      make("open-earlier-close", 0, 3),
      make("another-activity", -1, 1, { activityId: "running" }),
      make("join", -1, 1, { kind: "join" }),
    ],
    "reading",
    now,
  )
  expect(open.map(({ id }) => id)).toEqual(["open-earlier-close", "open-later-close"])
  expect(upcoming.map(({ id }) => id)).toEqual(["future"])
})

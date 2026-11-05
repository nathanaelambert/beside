import { attendanceMembers } from "./attendance"

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

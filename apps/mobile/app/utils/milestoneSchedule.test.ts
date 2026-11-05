import {
  dateInZone,
  initialScheduleForm,
  milestoneHelp,
  isWindowOpen,
  occurrenceLabels,
  overnightHint,
  quantityLabel,
  timeOptions,
  repeatOptions,
  scheduleFormToInput,
  scheduleSummary,
  validDate,
} from "./milestoneSchedule"

const now = new Date("2026-11-04T15:00:00Z")
const demo = () => ({
  ...initialScheduleForm(now),
  repeat: "weekly" as const,
  end: "date" as const,
  until: "2026-12-31",
})

it("maps Wednesday at 5 PM through exact Thursday midnight in Toronto", () => {
  const input = scheduleFormToInput(demo(), now)
  expect(input).toEqual({
    name: "Attendance",
    quantity: 1,
    itemId: null,
    timeZone: "America/Toronto",
    startDate: "2026-11-04",
    startTime: "17:00",
    endTime: "00:00",
    endDayOffset: 1,
    recurrence: { frequency: "weekly", interval: 1, weekdays: [3] },
    until: "2026-12-31",
    count: null,
  })
  expect(scheduleSummary(input)).toBe("Every Wednesday · 5:00 PM – midnight · until Dec 31, 2026")
})

it("derives weekday, day of month and ordinal from the start date", () => {
  expect(repeatOptions("2026-11-04").map((o) => o.label)).toEqual([
    "Does not repeat",
    "Every day",
    "Every week on Wednesday",
    "Every month on day 4",
    "Every month on the first Wednesday",
  ])
  expect(scheduleFormToInput({ ...demo(), repeat: "monthly" }, now).recurrence).toEqual({
    frequency: "monthly",
    interval: 1,
    dayOfMonth: 4,
  })
  expect(
    scheduleFormToInput({ ...demo(), startDate: "2026-11-25", repeat: "monthly-weekday" }, now)
      .recurrence,
  ).toEqual({ frequency: "monthly-weekday", interval: 1, weekday: 3, ordinal: 4 })
  expect(scheduleFormToInput({ ...demo(), repeat: "daily" }, now).recurrence).toEqual({
    frequency: "daily",
    interval: 1,
  })
})

it("maps never, inclusive date and occurrence count to mutually exclusive API fields", () => {
  expect(scheduleFormToInput({ ...demo(), end: "never" }, now)).toMatchObject({
    until: null,
    count: null,
  })
  expect(scheduleFormToInput({ ...demo(), end: "count", count: "9" }, now)).toMatchObject({
    until: null,
    count: 9,
  })
  // The schedule endpoint requires a recurrence, so a single window is daily + count 1.
  expect(scheduleFormToInput({ ...demo(), repeat: "none" }, now)).toMatchObject({
    recurrence: { frequency: "daily", interval: 1 },
    until: null,
    count: 1,
  })
})

it("infers overnight windows whenever Until is at or before From", () => {
  expect(() => scheduleFormToInput(demo(), now)).not.toThrow()
  expect(scheduleFormToInput({ ...demo(), endTime: "16:30" }, now).endDayOffset).toBe(1)
  expect(scheduleFormToInput({ ...demo(), endTime: "17:00" }, now).endDayOffset).toBe(1)
  expect(scheduleFormToInput({ ...demo(), endTime: "18:00" }, now).endDayOffset).toBe(0)
  expect(() => scheduleFormToInput({ ...demo(), startTime: "24:00" }, now)).toThrow(
    "valid start and end times",
  )
  expect(scheduleSummary(scheduleFormToInput({ ...demo(), endTime: "18:00" }, now))).toContain(
    "5:00–6:00 PM",
  )
})

it.each(["0", "-1", "1.5", "10001", "invalid"])("rejects invalid occurrence count %s", (count) => {
  expect(() => scheduleFormToInput({ ...demo(), end: "count", count }, now)).toThrow("occurrences")
})

it("validates names, quantities, dates, zones and inclusive end dates", () => {
  expect(validDate("2026-02-30")).toBe(false)
  expect(validDate("2028-02-29")).toBe(true)
  expect(() => scheduleFormToInput({ ...demo(), name: " " }, now)).toThrow("name")
  expect(() => scheduleFormToInput({ ...demo(), quantity: "Infinity" }, now)).toThrow("quantity")
  expect(() => scheduleFormToInput({ ...demo(), timeZone: "Somewhere/Unknown" }, now)).toThrow(
    "timezone",
  )
  expect(() => scheduleFormToInput({ ...demo(), startDate: "2026-11-03" }, now)).toThrow(
    "today or later",
  )
  expect(() => scheduleFormToInput({ ...demo(), until: "2026-11-03" }, now)).toThrow("end date")
  expect(() => scheduleFormToInput({ ...demo(), until: "2026-11-04" }, now)).not.toThrow()
})

it("uses the explicit Toronto demo default independently of device timezone", () => {
  expect(initialScheduleForm(now)).toMatchObject({
    timeZone: "America/Toronto",
    startTime: "17:00",
    endTime: "00:00",
  })
  expect(dateInZone(new Date("2026-11-04T01:00:00Z"), "America/Toronto")).toBe("2026-11-03")
})

it("summarizes single, counted and monthly rules including backend last-weekday rules", () => {
  const input = scheduleFormToInput(demo(), now)
  expect(
    scheduleSummary({ ...input, recurrence: { frequency: "daily" }, count: 1, until: null }),
  ).toBe("Once on Nov 4, 2026 · 5:00 PM – midnight")
  expect(scheduleSummary({ ...input, until: null, count: 9 })).toContain("9 occurrences")
  expect(
    scheduleSummary({ ...input, recurrence: { frequency: "monthly", dayOfMonth: 4 } }),
  ).toContain("Every month on day 4")
  expect(
    scheduleSummary({
      ...input,
      recurrence: { frequency: "monthly-weekday", weekday: 3, ordinal: -1 },
    }),
  ).toContain("Every month on the last Wednesday")
})

it.each(["steps", "pages", "chapters", "episodes", "sessions", "lessons", "minutes"])(
  "uses a singular %s unit for quantity 1",
  (unit) => {
    expect(quantityLabel(1, unit)).toBe(`1 ${unit.slice(0, -1)}`)
    expect(quantityLabel(2, unit)).toBe(`2 ${unit}`)
  },
)

it("preserves invariant units and formats concise occurrence windows", () => {
  expect(quantityLabel(1, "km")).toBe("1 km")
  expect(
    occurrenceLabels("2026-11-04T22:00:00.000Z", "2026-11-05T05:00:00.000Z", "America/Toronto"),
  ).toEqual({ date: "Wed, Nov 4", time: "5:00 PM – midnight" })
})

it("marks only the currently open window", () => {
  const start = "2026-11-04T22:00:00Z"
  const end = "2026-11-05T05:00:00Z"
  expect(isWindowOpen(start, end, Date.parse("2026-11-05T00:00:00Z"))).toBe(true)
  expect(isWindowOpen(start, end, Date.parse(start) - 1)).toBe(false)
  expect(isWindowOpen(start, end, Date.parse(end) + 1)).toBe(false)
})

it("offers 30-minute time lists with the overnight end in chronological order", () => {
  const starts = timeOptions()
  expect(starts).toHaveLength(48)
  expect(starts[0]).toEqual({ value: "00:00", label: "12:00 AM" })
  expect(starts.at(-1)).toEqual({ value: "23:30", label: "11:30 PM" })
  const ends = timeOptions("17:00")
  expect(ends).toHaveLength(14)
  expect(ends[0]).toEqual({ value: "17:30", label: "5:30 PM" })
  expect(ends.at(-1)).toEqual({ value: "00:00", label: "Midnight" })
  expect(ends.some((o) => o.value === "00:30")).toBe(false)
  expect(timeOptions("23:30")).toEqual([{ value: "00:00", label: "Midnight" }])
  expect(overnightHint(demo())).toBe("Ends at midnight, as Wednesday ends.")
  expect(overnightHint({ ...demo(), endTime: "18:00" })).toBe("")
})

it("keeps help concise and specific to the selected rule", () => {
  expect(milestoneHelp(demo())).toBe(
    "Each Wednesday is its own milestone. Log within the window; missed ones fail automatically.",
  )
  expect(milestoneHelp({ ...demo(), startDate: "2026-11-05" })).toContain("Each Thursday")
  expect(milestoneHelp({ ...demo(), repeat: "daily" })).toBe(
    "Each occurrence is its own milestone. Log within the window; missed ones fail automatically.",
  )
  for (const repeat of ["monthly", "monthly-weekday"] as const) {
    expect(milestoneHelp({ ...demo(), repeat })).toBe(
      "Each occurrence is its own milestone. Log within the window; missed ones fail automatically. Monthly dates that don't exist are skipped.",
    )
  }
})

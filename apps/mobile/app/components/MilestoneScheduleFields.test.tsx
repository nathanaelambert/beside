import { fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@/theme/context"
import { initialScheduleForm } from "@/utils/milestoneSchedule"

import { MilestoneScheduleFields, ScheduleDateField } from "./MilestoneScheduleFields"

it("chooses midnight from a time list without opening a keyboard", () => {
  const onChange = jest.fn()
  const value = {
    ...initialScheduleForm(new Date("2026-11-04T15:00:00Z")),
    endTime: "21:00",
  }
  const screen = render(
    <ThemeProvider>
      <MilestoneScheduleFields value={value} onChange={onChange} />
    </ThemeProvider>,
  )
  fireEvent.press(screen.getByTestId("schedule-end-time"))
  expect(screen.queryByTestId("schedule-end-time-hour")).toBeNull()
  expect(screen.queryByTestId("schedule-end-time-0030")).toBeNull()
  fireEvent.press(screen.getByTestId("schedule-end-time-0000"))
  expect(onChange).toHaveBeenCalledWith({ ...value, endTime: "00:00" })
})

it("only mentions skipped monthly dates for monthly rules", () => {
  const value = {
    ...initialScheduleForm(new Date("2026-11-04T15:00:00Z")),
    repeat: "weekly" as const,
  }
  const screen = render(
    <ThemeProvider>
      <MilestoneScheduleFields value={value} onChange={jest.fn()} />
    </ThemeProvider>,
  )
  expect(
    screen.getByText(
      "Each Wednesday is its own milestone. Log within the window; missed ones fail automatically.",
    ),
  ).toBeDefined()
  expect(screen.queryByText(/Monthly dates/)).toBeNull()
  screen.rerender(
    <ThemeProvider>
      <MilestoneScheduleFields value={{ ...value, repeat: "monthly" }} onChange={jest.fn()} />
    </ThemeProvider>,
  )
  expect(screen.getByText(/Monthly dates that don't exist are skipped/)).toBeDefined()
})

it("keeps the count and date ending choices separate", () => {
  const onChange = jest.fn()
  const value = { ...initialScheduleForm(), repeat: "weekly" as const }
  const screen = render(
    <ThemeProvider>
      <MilestoneScheduleFields value={value} onChange={onChange} />
    </ThemeProvider>,
  )
  fireEvent.press(screen.getByTestId("schedule-end"))
  fireEvent.press(screen.getByTestId("schedule-end-count"))
  expect(onChange).toHaveBeenCalledWith({ ...value, end: "count" })
})

it("selects the inclusive end date from the calendar", () => {
  const onChange = jest.fn()
  const screen = render(
    <ThemeProvider>
      <ScheduleDateField label="Until" value="2026-12-01" testID="until" onChange={onChange} />
    </ThemeProvider>,
  )
  fireEvent.press(screen.getByTestId("until"))
  expect(screen.queryByTestId("until-input")).toBeNull()
  fireEvent.press(screen.getByTestId("until-2026-12-31"))
  expect(onChange).toHaveBeenCalledWith("2026-12-31")
  expect(screen.queryByTestId("until-2026-12-31")).toBeNull()
})

it("shows a read-only timezone and an inferred overnight hint", () => {
  const value = initialScheduleForm(new Date("2026-11-04T15:00:00Z"))
  const screen = render(
    <ThemeProvider>
      <MilestoneScheduleFields value={value} onChange={jest.fn()} />
    </ThemeProvider>,
  )
  expect(screen.getByText("Times in Eastern Time (America/Toronto)")).toBeDefined()
  expect(screen.getByText("Ends at midnight, as Wednesday ends.")).toBeDefined()
  expect(screen.queryByTestId("schedule-end-day")).toBeNull()
})

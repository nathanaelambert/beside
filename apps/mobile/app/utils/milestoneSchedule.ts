import type { CreateScheduleInput } from "@beside/api-client"

export type RepeatOption = "none" | "daily" | "weekly" | "monthly" | "monthly-weekday"
export type ScheduleForm = {
  name: string
  quantity: string
  startDate: string
  startTime: string
  endTime: string
  timeZone: string
  repeat: RepeatOption
  end: "never" | "date" | "count"
  until: string
  count: string
}

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const ordinals = ["", "first", "second", "third", "fourth", "fifth"]

export function dateInZone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const part = (type: string) => parts.find((p) => p.type === type)!.value
  return `${part("year")}-${part("month")}-${part("day")}`
}

export function initialScheduleForm(now = new Date()): ScheduleForm {
  const timeZone = "America/Toronto"
  const startDate = dateInZone(now, timeZone)
  return {
    name: "Attendance",
    quantity: "1",
    startDate,
    startTime: "17:00",
    endTime: "00:00",
    timeZone,
    repeat: "none",
    end: "never",
    until: `${startDate.slice(0, 4)}-12-31`,
    count: "10",
  }
}

export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  )
}

export function repeatOptions(date: string): { value: RepeatOption; label: string }[] {
  const anchor = new Date(`${validDate(date) ? date : "2026-01-01"}T12:00:00Z`)
  const weekday = weekdays[anchor.getUTCDay()]
  return [
    { value: "none", label: "Does not repeat" },
    { value: "daily", label: "Every day" },
    { value: "weekly", label: `Every week on ${weekday}` },
    { value: "monthly", label: `Every month on day ${anchor.getUTCDate()}` },
    {
      value: "monthly-weekday",
      label: `Every month on the ${ordinals[Math.ceil(anchor.getUTCDate() / 7)]} ${weekday}`,
    },
  ]
}

export function scheduleFormToInput(form: ScheduleForm, now = new Date()): CreateScheduleInput {
  if (!form.name.trim() || form.name.trim().length > 200)
    throw new Error("Enter a milestone name (up to 200 characters).")
  const quantity = Number(form.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0)
    throw new Error("Enter a quantity greater than zero.")
  try {
    new Intl.DateTimeFormat("en", { timeZone: form.timeZone })
  } catch {
    throw new Error("Choose a valid timezone.")
  }
  if (!validDate(form.startDate)) throw new Error("Enter a valid start date.")
  if (form.startDate < dateInZone(now, form.timeZone))
    throw new Error("Choose a start date of today or later.")
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
  if (!timePattern.test(form.startTime) || !timePattern.test(form.endTime))
    throw new Error("Choose valid start and end times.")
  const anchor = new Date(`${form.startDate}T12:00:00Z`)
  const recurrence: CreateScheduleInput["recurrence"] =
    form.repeat === "weekly"
      ? { frequency: "weekly", interval: 1, weekdays: [anchor.getUTCDay()] }
      : form.repeat === "monthly"
        ? { frequency: "monthly", interval: 1, dayOfMonth: anchor.getUTCDate() }
        : form.repeat === "monthly-weekday"
          ? {
              frequency: "monthly-weekday",
              interval: 1,
              weekday: anchor.getUTCDay(),
              ordinal: Math.ceil(anchor.getUTCDate() / 7),
            }
          : { frequency: "daily", interval: 1 }
  const until = form.repeat !== "none" && form.end === "date" ? form.until : null
  const count = form.repeat === "none" ? 1 : form.end === "count" ? Number(form.count) : null
  if (until !== null && (!validDate(until) || until < form.startDate))
    throw new Error("Choose an end date on or after the start date.")
  if (count !== null && (!Number.isInteger(count) || count < 1 || count > 10000))
    throw new Error("Enter between 1 and 10,000 occurrences.")
  return {
    name: form.name.trim(),
    quantity,
    itemId: null,
    timeZone: form.timeZone,
    startDate: form.startDate,
    startTime: form.startTime,
    endTime: form.endTime,
    endDayOffset: form.endTime <= form.startTime ? 1 : 0,
    recurrence,
    until,
    count,
  }
}

export function shortDate(date: string) {
  if (!validDate(date)) return date
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`))
}

export function timeLabel(time: string) {
  const [hour, minute] = time.split(":").map(Number)
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`
}

export function timeOptions(after?: string) {
  const startMinutes = after ? Number(after.slice(0, 2)) * 60 + Number(after.slice(3)) : -30
  const first = after ? Math.floor(startMinutes / 30) * 30 + 30 : 0
  const length = after ? (1440 - first) / 30 + 1 : 48
  return Array.from({ length }, (_, index) => {
    const minutes = (first + index * 30) % 1440
    const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
    return { value, label: after && value === "00:00" ? "Midnight" : timeLabel(value) }
  })
}

export function milestoneHelp(form: Pick<ScheduleForm, "repeat" | "startDate">) {
  const subject =
    form.repeat === "weekly" && validDate(form.startDate)
      ? `Each ${weekdays[new Date(`${form.startDate}T12:00:00Z`).getUTCDay()]}`
      : "Each occurrence"
  const monthly = form.repeat === "monthly" || form.repeat === "monthly-weekday"
  return `${subject} is its own milestone. Log within the window; missed ones fail automatically.${monthly ? " Monthly dates that don't exist are skipped." : ""}`
}

export function overnightHint(form: ScheduleForm) {
  if (form.endTime > form.startTime || !validDate(form.startDate)) return ""
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${form.startDate}T12:00:00Z`),
  )
  return form.endTime === "00:00" ? `Ends at midnight, as ${day} ends.` : "Ends the next day."
}

export function quantityLabel(quantity: number, unit: string) {
  const singular: Record<string, string> = {
    steps: "step",
    pages: "page",
    chapters: "chapter",
    episodes: "episode",
    sessions: "session",
    lessons: "lesson",
    minutes: "minute",
  }
  return `${quantity} ${quantity === 1 ? (singular[unit] ?? unit) : unit}`
}

export function isWindowOpen(start: string | null, end: string | null, now = Date.now()) {
  return !!start && !!end && Date.parse(start) <= now && now <= Date.parse(end)
}

export function occurrenceLabels(start: string | null, end: string | null, timeZone: string) {
  if (!start) return { date: "Any time", time: "" }
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(start))
  const time = (value: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(
      new Date(value),
    )
  const midnight =
    end &&
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(end)) === "00:00"
  return { date, time: `${time(start)}${end ? ` – ${midnight ? "midnight" : time(end)}` : ""}` }
}

export function scheduleSummary(s: CreateScheduleInput) {
  const r = s.recurrence
  const interval = r.interval ?? 1
  let rule: string
  if (r.frequency === "daily") rule = interval === 1 ? "Every day" : `Every ${interval} days`
  else if (r.frequency === "weekly")
    rule = `${interval === 1 ? "Every" : `Every ${interval} weeks on`} ${r.weekdays.map((d) => weekdays[d]).join(", ")}`
  else if (r.frequency === "monthly")
    rule = `Every ${interval === 1 ? "month" : `${interval} months`} on day ${r.dayOfMonth}`
  else
    rule = `Every ${interval === 1 ? "month" : `${interval} months`} on the ${r.ordinal === -1 ? "last" : ordinals[r.ordinal]} ${weekdays[r.weekday]}`
  const single = r.frequency === "daily" && s.count === 1
  if (single) rule = `Once on ${shortDate(s.startDate)}`
  const start = timeLabel(s.startTime)
  const end = timeLabel(s.endTime)
  const window =
    s.endTime === "00:00" && s.endDayOffset === 1
      ? `${start} – midnight`
      : `${start.slice(-2) === end.slice(-2) ? start.slice(0, -3) : start}–${end}${s.endDayOffset ? " (next day)" : ""}`
  const ending = s.until
    ? ` · until ${shortDate(s.until)}`
    : !single && s.count
      ? ` · ${s.count} occurrence${s.count === 1 ? "" : "s"}`
      : ""
  return `${rule} · ${window}${ending}`
}

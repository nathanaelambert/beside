import { z } from "zod";

const weekday = z.number().int().min(0).max(6); // Sunday = 0.
export const recurrenceSchema = z.discriminatedUnion("frequency", [
  z.strictObject({
    frequency: z.literal("daily"),
    interval: z.number().int().min(1).max(365).default(1),
  }),
  z.strictObject({
    frequency: z.literal("weekly"),
    interval: z.number().int().min(1).max(52).default(1),
    weekdays: z.array(weekday).min(1).max(7),
  }),
  z.strictObject({
    frequency: z.literal("monthly"),
    interval: z.number().int().min(1).max(12).default(1),
    dayOfMonth: z.number().int().min(1).max(31),
  }),
  z.strictObject({
    frequency: z.literal("monthly-weekday"),
    interval: z.number().int().min(1).max(12).default(1),
    weekday,
    ordinal: z.union([z.literal(-1), z.number().int().min(1).max(5)]),
  }),
]);
const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const createScheduleSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(200),
    quantity: z.number().positive().finite(),
    itemId: z.string().min(1).max(200).nullable().default(null),
    timeZone: z
      .string()
      .min(1)
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Use a valid IANA timezone."),
    startDate: z.iso.date(),
    startTime: localTime,
    endTime: localTime,
    endDayOffset: z.number().int().min(0).max(7).default(0),
    recurrence: recurrenceSchema,
    until: z.iso.date().nullable().default(null), // Inclusive occurrence start date.
    count: z.number().int().min(1).max(10000).nullable().default(null),
  })
  .superRefine((s, ctx) => {
    if (s.endDayOffset === 0 && s.endTime <= s.startTime)
      ctx.addIssue({
        code: "custom",
        message: "The window end must follow its start.",
      });
    if (s.until && s.until < s.startDate)
      ctx.addIssue({
        code: "custom",
        message: "The recurrence end precedes its start.",
      });
    if (s.until && s.count)
      ctx.addIssue({
        code: "custom",
        message: "Choose either an end date or an occurrence count.",
      });
  });
export type ScheduleInput = z.infer<typeof createScheduleSchema>;
export type CreateScheduleInput = z.input<typeof createScheduleSchema>;
export const scheduleSchema = z.object({
  id: z.string(),
  activityId: z.string(),
  creatorUserId: z.string(),
  configuration: createScheduleSchema,
  nextDate: z.iso.date(),
  generatedCount: z.number().int(),
  enabled: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type MilestoneSchedule = z.infer<typeof scheduleSchema>;

const dayMs = 86400000;
export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * dayMs)
    .toISOString()
    .slice(0, 10);

export function occursOn(s: ScheduleInput, date: string): boolean {
  if (date < s.startDate || (s.until && date > s.until)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  const anchor = new Date(`${s.startDate}T00:00:00Z`);
  const days = Math.round((d.getTime() - anchor.getTime()) / dayMs);
  const r = s.recurrence;
  if (r.frequency === "daily") return days % r.interval === 0;
  if (r.frequency === "weekly") {
    // Weeks start on Monday, independent of the machine's locale.
    const anchorWeekday = (anchor.getUTCDay() + 6) % 7;
    return (
      Math.floor((days + anchorWeekday) / 7) % r.interval === 0 &&
      r.weekdays.includes(d.getUTCDay())
    );
  }
  const months =
    (d.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    d.getUTCMonth() -
    anchor.getUTCMonth();
  if (months % r.interval !== 0) return false;
  if (r.frequency === "monthly") return d.getUTCDate() === r.dayOfMonth;
  if (d.getUTCDay() !== r.weekday) return false;
  return r.ordinal === -1
    ? new Date(d.getTime() + 7 * dayMs).getUTCMonth() !== d.getUTCMonth()
    : Math.ceil(d.getUTCDate() / 7) === r.ordinal;
}

export function localDateAt(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const value = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

// Resolve wall-clock times from actual zone offsets around the date. In an
// autumn overlap choose the earlier instant; skip nonexistent spring times.
export function wallTime(
  date: string,
  time: string,
  timeZone: string,
): string | null {
  const naive = Date.parse(`${date}T${time}:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const localEpoch = (instant: number) => {
    const parts = formatter.formatToParts(new Date(instant));
    const v = (type: string) => parts.find((p) => p.type === type)!.value;
    return Date.parse(
      `${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}:${v("second")}Z`,
    );
  };
  const candidates = new Set<number>();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const probe = naive + hours * 3600000;
    const candidate = naive - (localEpoch(probe) - probe);
    if (localEpoch(candidate) === naive) candidates.add(candidate);
  }
  return candidates.size
    ? new Date(Math.min(...candidates)).toISOString()
    : null;
}

export function occurrenceWindow(s: ScheduleInput, date: string) {
  const startAt = wallTime(date, s.startTime, s.timeZone);
  const endAt = wallTime(addDays(date, s.endDayOffset), s.endTime, s.timeZone);
  return startAt && endAt && endAt > startAt ? { startAt, endAt } : null;
}

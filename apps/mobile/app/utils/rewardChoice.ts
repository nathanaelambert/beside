import type { ApiState, CreateScheduleInput, RewardAgreement } from "@beside/api-client"
import { guideFor, type RewardRole } from "@beside/rewards/guidance"

import type { ScheduleForm } from "./milestoneSchedule"

type Milestone = ApiState["milestones"][number]
type Reward = ApiState["rewards"][number]
type Item = ApiState["rewardItems"][number]

/** How often a milestone happens. Equal-value rewards land once per occurrence. */
export interface Cadence {
  recurring: boolean
  /** Known number of occurrences, or null for an open-ended series. */
  occurrences: number | null
  /** "weekly milestone", "one-off milestone"… */
  label: string
}

const frequencyLabel: Record<string, string> = {
  "none": "one-off",
  "daily": "daily",
  "weekly": "weekly",
  "monthly": "monthly",
  "monthly-weekday": "monthly",
}

export function cadenceFromForm(form: Pick<ScheduleForm, "repeat" | "end" | "count">): Cadence {
  if (form.repeat === "none")
    return { recurring: false, occurrences: 1, label: "one-off milestone" }
  const count = Number(form.count)
  return {
    recurring: true,
    occurrences: form.end === "count" && Number.isInteger(count) && count > 0 ? count : null,
    label: `${frequencyLabel[form.repeat]} milestone`,
  }
}

export function cadenceFromSchedule(
  configuration?: Pick<CreateScheduleInput, "recurrence" | "count">,
): Cadence {
  // "Does not repeat" is saved as a daily series with a single occurrence.
  if (!configuration || configuration.count === 1)
    return { recurring: false, occurrences: 1, label: "one-off milestone" }
  return {
    recurring: true,
    occurrences: configuration.count ?? null,
    label: `${frequencyLabel[configuration.recurrence.frequency] ?? "repeating"} milestone`,
  }
}

/** Which kinds of reward fit this milestone's shape, and why. Never a price. */
export function suggestion(cadence: Cadence): { roles: RewardRole[]; text: string } {
  return cadence.recurring
    ? {
        roles: ["collection"],
        text: `Suggested for a ${cadence.label}: flowers and trees. One lands every session, so they grow into a flower bed or a grove.`,
      }
    : {
        roles: ["landmark", "marker"],
        text: `Suggested for a ${cadence.label}: a landmark or a marker. One moment, one thing to remember it by.`,
      }
}

/**
 * Hold up a mirror instead of a price tag: say what the choice will look like in
 * the meadow, and let the group decide. Returns null when the choice already fits.
 */
export function rewardMirror(item: Pick<Item, "name" | "category">, cadence: Cadence) {
  const { role } = guideFor(item.category)
  if (role === "landmark" && cadence.recurring)
    return cadence.occurrences
      ? `This repeats ${cadence.occurrences} times, so that’s ${cadence.occurrences} × ${item.name}. Landmarks usually mark one moment; flowers and trees grow into a collection.`
      : `This repeats with no end date, so a new ${item.name} lands every session. Landmarks usually mark one moment; flowers and trees grow into a collection.`
  if (role === "collection" && !cadence.recurring)
    return `A single ${item.name} is a quiet keepsake. Perfect for a small moment; if this one is big, a landmark will stand out more.`
  return null
}

/** How many of each item this home base has already earned. */
export function meadowCounts(state: Pick<ApiState, "rewards">, homebaseId: string | undefined) {
  const counts = new Map<string, number>()
  for (const reward of state.rewards)
    if (reward.homebaseId === homebaseId && reward.obtainedAt)
      counts.set(reward.itemId, (counts.get(reward.itemId) ?? 0) + 1)
  return counts
}

export function namesLabel(names: string[]) {
  if (names.length <= 1) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name
}

export type RewardStatus = "proposed" | "locked" | "earned" | "placed" | "missed"

/**
 * - proposed: still changeable; nobody has checked in yet.
 * - locked: someone checked in, so the item is fixed (an API rule).
 * - earned: everyone on the roster completed it; waiting to be placed.
 * - placed: standing in the meadow.
 * - missed: the window closed before everyone checked in.
 */
export function rewardStatus({
  reward,
  milestone,
  logs,
  placedRewardIds,
  now,
}: {
  reward: Reward
  milestone: Milestone
  logs: Pick<ApiState["logs"][number], "milestoneId">[]
  placedRewardIds: Set<string>
  now: number
}): RewardStatus {
  if (reward.obtainedAt) return placedRewardIds.has(reward.id) ? "placed" : "earned"
  if (milestone.endAt && Date.parse(milestone.endAt) < now) return "missed"
  if (logs.some((log) => log.milestoneId === milestone.id)) return "locked"
  return "proposed"
}

/** Agreements to the reward's current item, roster order. */
export function agreedUserIds(reward: Reward, agreements: RewardAgreement[]) {
  const agreed = new Set(
    agreements
      .filter((row) => row.rewardId === reward.id && row.itemId === reward.itemId)
      .map((row) => row.userId),
  )
  return reward.requiredUserIds.filter((userId) => agreed.has(userId))
}

/** Earned rewards in this home base that are not standing in the meadow yet, oldest first. */
export function rewardsToPlace(
  state: Pick<ApiState, "rewards">,
  homebaseId: string | undefined,
  placedRewardIds: Set<string>,
) {
  return state.rewards
    .filter((r) => r.homebaseId === homebaseId && r.obtainedAt && !placedRewardIds.has(r.id))
    .sort((a, b) => Date.parse(a.obtainedAt!) - Date.parse(b.obtainedAt!))
}

/** The story an earned reward carries: which milestone and activity earned it. */
export function rewardMemory(state: Pick<ApiState, "milestones" | "activities">, rewardId: string) {
  const milestone = state.milestones.find((m) => m.rewardId === rewardId)
  const activity = milestone && state.activities.find((a) => a.id === milestone.activityId)
  return { milestone, activity }
}

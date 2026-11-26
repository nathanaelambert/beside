import {
  agreedUserIds,
  cadenceFromForm,
  cadenceFromSchedule,
  meadowCounts,
  namesLabel,
  rewardMirror,
  rewardStatus,
  rewardsToPlace,
  suggestion,
} from "./rewardChoice"

const reward = {
  id: "r1",
  homebaseId: "base",
  itemId: "star-statue",
  obtainedAt: null as string | null,
  requiredUserIds: ["a", "b", "c"],
  upgradeCount: 0,
  buildReadyAt: null,
}
const milestone = {
  id: "m1",
  activityId: "act",
  parentId: "root",
  kind: "achievement" as const,
  name: "Last chapter",
  quantity: 1,
  policy: "paced" as const,
  startAt: "2026-11-13T22:00:00.000Z",
  endAt: "2026-11-14T05:00:00.000Z",
  rewardId: "r1",
  upgradeRewardId: null,
  upgradeRequiredUserIds: [],
  upgradeCreditedAt: null,
  createdAt: "2026-11-01T00:00:00.000Z",
}
const during = Date.parse("2026-11-13T23:00:00.000Z")

describe("reward cadence", () => {
  it("treats a single occurrence as one-off and counts known repeats", () => {
    expect(cadenceFromForm({ repeat: "none", end: "never", count: "10" })).toEqual({
      recurring: false,
      occurrences: 1,
      label: "one-off milestone",
    })
    expect(cadenceFromForm({ repeat: "weekly", end: "count", count: "12" })).toEqual({
      recurring: true,
      occurrences: 12,
      label: "weekly milestone",
    })
    expect(cadenceFromForm({ repeat: "daily", end: "never", count: "12" }).occurrences).toBeNull()
    expect(
      cadenceFromSchedule({ recurrence: { frequency: "daily", interval: 1 }, count: 1 }).recurring,
    ).toBe(false)
    expect(
      cadenceFromSchedule({
        recurrence: { frequency: "weekly", interval: 1, weekdays: [3] },
        count: null,
      }),
    ).toEqual({ recurring: true, occurrences: null, label: "weekly milestone" })
  })

  it("suggests collections for repeats and landmarks for one-off moments", () => {
    expect(
      suggestion(cadenceFromForm({ repeat: "weekly", end: "never", count: "" })).roles,
    ).toEqual(["collection"])
    expect(suggestion(cadenceFromForm({ repeat: "none", end: "never", count: "" })).roles).toEqual([
      "landmark",
      "marker",
    ])
  })
})

describe("reward mirror", () => {
  const weekly = { recurring: true, occurrences: 12, label: "weekly milestone" }
  const once = { recurring: false, occurrences: 1, label: "one-off milestone" }
  it("shows what repeating a landmark looks like, without blocking it", () => {
    expect(rewardMirror({ name: "Watchful owl", category: "Statues" }, weekly)).toMatch(
      /12 × Watchful owl/,
    )
    expect(
      rewardMirror({ name: "Watchful owl", category: "Statues" }, { ...weekly, occurrences: null }),
    ).toMatch(/no end date/)
  })
  it("notes a small keepsake for a one-off, and stays quiet when the choice fits", () => {
    expect(rewardMirror({ name: "Sunflower", category: "Flowers" }, once)).toMatch(/quiet keepsake/)
    expect(rewardMirror({ name: "Sunflower", category: "Flowers" }, weekly)).toBeNull()
    expect(rewardMirror({ name: "Wishing star", category: "Statues" }, once)).toBeNull()
  })
})

describe("reward status", () => {
  const status = (
    overrides: Partial<typeof reward>,
    logs: { milestoneId: string }[] = [],
    now = during,
  ) =>
    rewardStatus({
      reward: { ...reward, ...overrides },
      milestone,
      logs,
      placedRewardIds: new Set(["placed"]),
      now,
    })
  it("follows a reward from proposal to the meadow", () => {
    expect(status({})).toBe("proposed")
    expect(status({}, [{ milestoneId: "m1" }])).toBe("locked")
    expect(status({ obtainedAt: "2026-11-13T23:30:00.000Z" })).toBe("earned")
    expect(status({ id: "placed", obtainedAt: "2026-11-13T23:30:00.000Z" })).toBe("placed")
    expect(status({}, [{ milestoneId: "m1" }], Date.parse("2026-11-15T00:00:00.000Z"))).toBe(
      "missed",
    )
  })
})

describe("reward helpers", () => {
  it("counts only current-item agreements, in roster order", () => {
    const at = "2026-11-13T00:00:00.000Z"
    expect(
      agreedUserIds(reward, [
        { rewardId: "r1", userId: "c", itemId: "star-statue", agreedAt: at },
        { rewardId: "r1", userId: "a", itemId: "star-statue", agreedAt: at },
        { rewardId: "r1", userId: "b", itemId: "sunflower", agreedAt: at },
        { rewardId: "r2", userId: "b", itemId: "star-statue", agreedAt: at },
      ]),
    ).toEqual(["a", "c"])
  })
  it("counts earned items and lists the ones still waiting to be placed", () => {
    const state = {
      rewards: [
        { ...reward, id: "x", itemId: "oak-tree", obtainedAt: "2026-11-12T00:00:00.000Z" },
        { ...reward, id: "y", itemId: "oak-tree", obtainedAt: "2026-11-11T00:00:00.000Z" },
        { ...reward, id: "z", itemId: "sunflower" },
        { ...reward, id: "w", homebaseId: "other", obtainedAt: "2026-11-11T00:00:00.000Z" },
      ],
    }
    expect([...meadowCounts(state, "base")]).toEqual([["oak-tree", 2]])
    expect(rewardsToPlace(state, "base", new Set(["x"])).map((r) => r.id)).toEqual(["y"])
    expect(rewardsToPlace(state, "base", new Set()).map((r) => r.id)).toEqual(["y", "x"])
  })
  it("joins names naturally", () => {
    expect(namesLabel(["Mosaab"])).toBe("Mosaab")
    expect(namesLabel(["Mosaab", "Nathanael", "Vaibhav"])).toBe("Mosaab, Nathanael and Vaibhav")
  })
})

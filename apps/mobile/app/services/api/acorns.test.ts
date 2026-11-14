import { earnHint, homebaseAcorns, milestoneEarnings, shopCards } from "./acorns"

const entry = (fields: Record<string, unknown>) =>
  ({
    id: `e${Math.random()}`,
    homebaseId: "base",
    userId: "ana",
    milestoneId: null,
    decorationId: null,
    note: "",
    createdAt: "2026-11-13T10:00:00.000Z",
    ...fields,
  }) as never

describe("acorn helpers", () => {
  it("sums only this home base's pool, newest first", () => {
    const { balance, history } = homebaseAcorns(
      {
        acornEntries: [
          entry({ amount: 2, kind: "check-in", createdAt: "2026-11-13T10:00:00.000Z" }),
          entry({ amount: 16, kind: "together", createdAt: "2026-11-13T11:00:00.000Z" }),
          entry({ amount: -10, kind: "purchase", createdAt: "2026-11-13T12:00:00.000Z" }),
          entry({ amount: 50, kind: "check-in", homebaseId: "other" }),
        ],
      },
      "base",
    )
    expect(balance).toBe(8)
    expect(history.map((row) => row.amount)).toEqual([-10, 16, 2])
  })

  it("marks items affordable, short, or sold out", () => {
    const cards = shopCards(30, [{ itemId: "owl-statue" }])
    const byId = Object.fromEntries(cards.map((card) => [card.itemId, card]))
    expect(byId.sunflower).toMatchObject({ price: 10, affordable: true, missing: 0 })
    expect(byId["rose-pennant"]).toMatchObject({ price: 50, affordable: false, missing: 20 })
    expect(byId["owl-statue"]).toMatchObject({ soldOut: true, affordable: false, owned: 1 })
    expect(byId["star-statue"]).toMatchObject({ soldOut: false, missing: 90 })
    expect(cards[0]!.rarity).toBe("common")
    expect(cards.at(-1)!.rarity).toBe("legendary")
  })

  it("previews the together bonus from people who had joined when it was planned", () => {
    const join = { id: "zero", activityId: "a", kind: "join", createdAt: "2026-11-01T00:00:00Z" }
    const joined = (userId: string, createdAt: string) => ({
      id: `log-${userId}`,
      milestoneId: "zero",
      authorUserId: userId,
      isSuccess: true,
      createdAt,
    })
    const state = {
      milestones: [join],
      participations: ["ana", "ben", "cy"].map((userId) => ({
        id: userId,
        activityId: "a",
        userId,
        target: 1,
        status: "active",
      })),
      logs: [
        joined("ana", "2026-11-01T00:00:00Z"),
        joined("ben", "2026-11-01T00:00:00Z"),
        joined("cy", "2026-11-20T00:00:00Z"),
      ],
      acornEntries: [entry({ amount: 2, kind: "check-in", milestoneId: "m1" })],
    } as never
    const earnings = milestoneEarnings(state, {
      id: "m1",
      activityId: "a",
      createdAt: "2026-11-10T00:00:00Z",
    })
    expect(earnings).toMatchObject({ rosterSize: 2, togetherBonus: 16, checkedIn: ["ana"] })
  })

  it("explains how far away an item is", () => {
    expect(earnHint(20, 2)).toBe("One milestone where everyone shows up earns 20.")
    expect(earnHint(90, 4)).toBe("About 3 milestones where everyone shows up (40 each).")
  })
})

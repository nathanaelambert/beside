import { z } from "zod";
import type { Database } from "./types.ts";
import { migrateDemoIdentity, migrateMilestones } from "./migrations.ts";
import { rewardItems } from "@beside/rewards";

const key = z.string().min(1).max(200);
const text = z.string().max(2000);
const date = z.iso.datetime();
const category = z.enum([
  "reading",
  "watching",
  "movement",
  "cooking",
  "learning",
  "habits",
  "custom",
]);
const origin = z.enum(["manual", "voice", "mcp", "automation"]);
const mode = z.enum(["position", "sum", "sessions"]);
const rows = <T extends z.ZodType>(schema: T) => z.array(schema).max(20000);
const pixelArt = z
  .object({
    format: z.literal("pixel-art"),
    palette: z.record(
      z.string().regex(/^[A-Za-z0-9]$/),
      z.string().regex(/^#[0-9a-fA-F]{6}$/),
    ),
    pixels: z
      .array(
        z
          .string()
          .min(1)
          .max(64)
          .regex(/^[.A-Za-z0-9]+$/),
      )
      .min(1)
      .max(64),
  })
  .superRefine((art, ctx) => {
    if (art.pixels.some((row) => row.length !== art.pixels[0]!.length))
      ctx.addIssue({
        code: "custom",
        message: "Pixel-art rows must have equal widths.",
      });
    const pixels = art.pixels.join("");
    if (
      !/[A-Za-z0-9]/.test(pixels) ||
      [...pixels].some(
        (color) => color !== "." && !Object.hasOwn(art.palette, color),
      )
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Pixel art needs visible pixels and a color for every palette key.",
      });
  });
export const policySchema = z.enum(["open", "paced", "deadline"]);
export const milestoneInputSchema = z
  .object({
    activityId: key,
    parentId: key.nullable(),
    name: z.string().trim().min(1).max(200),
    quantity: z.number().positive().finite(),
    policy: policySchema,
    startAt: date.nullable(),
    endAt: date.nullable(),
    itemId: key.nullable(),
  })
  .superRefine((m, ctx) => {
    if (m.policy === "paced" && (!m.startAt || !m.endAt))
      ctx.addIssue({
        code: "custom",
        message: "Paced milestones need a start and end.",
      });
    if (m.policy === "deadline" && m.startAt)
      ctx.addIssue({
        code: "custom",
        message: "Deadline milestones have no start restriction.",
      });
    if (m.policy === "deadline" && !m.endAt)
      ctx.addIssue({
        code: "custom",
        message: "Deadline milestones need an end.",
      });
    if (m.startAt && m.endAt && Date.parse(m.startAt) >= Date.parse(m.endAt))
      ctx.addIssue({
        code: "custom",
        message: "The end must be after the start.",
      });
    if (m.policy === "open" && (m.startAt || m.endAt))
      ctx.addIssue({
        code: "custom",
        message: "Open milestones have no schedule.",
      });
  });
export const logInputSchema = z
  .object({
    authorUserId: key,
    milestoneId: key,
    isSuccess: z.boolean(),
    title: z.string().trim().min(1).max(500),
    durationMinutes: z.number().nonnegative().finite(),
    occurredAt: date,
    origin,
    externalKey: key.nullable().optional(),
  })
  .strict();
export const databaseSchema = z.object({
  version: z.literal(2),
  // Only missing legacy catalogs are seeded. An intentionally empty one stays empty.
  rewardItems: rows(
    z.object({
      id: key,
      name: z.string().trim().min(1).max(200),
      category: z.string().trim().min(1).max(80),
      artifact: pixelArt,
    }),
  ).default(() => structuredClone(rewardItems)),
  users: rows(
    z.object({
      id: key,
      name: key,
      email: z.email(),
      color: z.enum(["blue", "rose", "moss"]),
    }),
  ).min(1),
  connections: rows(
    z.object({ id: key, name: key, personalOwnerId: key.nullable() }),
  ),
  memberships: rows(z.object({ id: key, connectionId: key, userId: key })),
  subjectTemplates: rows(
    z.object({ id: key, name: key, category, fields: z.array(key), unit: key }),
  ).min(1),
  activityTemplates: rows(
    z.object({
      id: key,
      name: key,
      category,
      description: text,
      progressMode: mode,
      unit: key,
      target: z.number().positive().finite(),
    }),
  ).min(1),
  subjects: rows(
    z.object({
      id: key,
      templateId: key,
      ownerUserId: key,
      title: key,
      metadata: z.record(key, text),
      createdAt: date,
    }),
  ),
  activities: rows(
    z.object({
      id: key,
      templateId: key,
      creatorUserId: key,
      personalOwnerId: key.nullable(),
      connectionId: key.nullable(),
      name: key,
      description: text,
      category,
      progressMode: mode,
      unit: key,
      createdAt: date,
    }),
  ),
  activitySubjects: rows(
    z.object({ id: key, activityId: key, subjectId: key }),
  ),
  participations: rows(
    z.object({
      id: key,
      activityId: key,
      userId: key,
      target: z.number().positive().finite(),
      status: z.enum(["invited", "active", "finished", "left"]),
    }),
  ),
  milestones: rows(
    z.object({
      id: key,
      activityId: key,
      parentId: key,
      kind: z.enum(["join", "achievement"]),
      name: z.string().trim().min(1).max(200),
      quantity: z.number().positive().finite(),
      policy: policySchema,
      startAt: date.nullable(),
      endAt: date.nullable(),
      rewardId: key.nullable(),
      createdAt: date,
    }),
  ),
  rewards: rows(
    z.object({
      id: key,
      homebaseId: key,
      itemId: key,
      obtainedAt: date.nullable(),
      requiredUserIds: z.array(key).min(1),
    }),
  ),
  logs: rows(
    z.object({
      id: key,
      milestoneId: key.nullable(),
      isSuccess: z.boolean(),
      authorUserId: key,
      subjectId: key.nullable(),
      category,
      title: z.string().min(1).max(500),
      quantity: z.number().positive().finite(),
      unit: key,
      durationMinutes: z.number().nonnegative().finite(),
      occurredAt: date,
      origin,
      externalKey: key.nullable(),
      createdAt: date,
    }),
  ),
  logShares: rows(
    z.object({ id: key, logId: key, connectionId: key, sharedByUserId: key }),
  ),
  contributions: rows(
    z.object({
      id: key,
      logId: key,
      participationId: key,
      amount: z.number().positive().finite(),
    }),
  ),
  events: rows(
    z.object({
      id: key,
      actorUserId: key,
      type: key,
      entityType: z.enum(["subject", "activity", "log", "milestone", "reward"]),
      entityId: key,
      message: text,
      origin,
      createdAt: date,
    }),
  ),
  deliveries: rows(
    z.object({
      id: key,
      eventId: key,
      recipientUserId: key,
      connectionId: key.nullable(),
      kind: z.enum(["private", "update", "progress", "activity"]),
    }),
  ),
});
export function parseDatabase(input: unknown): Database {
  const db = migrateDemoIdentity(
    databaseSchema.parse(migrateMilestones(input)),
  );
  const tables = Object.entries(db).filter(([name]) => name !== "version") as [
    string,
    { id: string }[],
  ][];
  for (const [name, records] of tables)
    if (new Set(records.map((r) => r.id)).size !== records.length)
      throw new Error(`Duplicate primary key in ${name}.`);
  const fk = (ids: { id: string }[], value: string | null) => {
    if (value !== null && !ids.some((r) => r.id === value))
      throw new Error(`Broken foreign key: ${value}.`);
  };
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length)
      throw new Error(`Duplicate ${label}.`);
  };
  const inConnection = (connectionId: string, userId: string) =>
    db.memberships.some(
      (m) => m.connectionId === connectionId && m.userId === userId,
    );
  unique(
    db.users.map((u) => u.email),
    "user email",
  );
  for (const base of db.connections) fk(db.users, base.personalOwnerId);
  unique(
    db.connections
      .filter((b) => b.personalOwnerId)
      .map((b) => b.personalOwnerId!),
    "personal home base",
  );
  for (const user of db.users)
    if (!db.connections.some((b) => b.personalOwnerId === user.id))
      throw new Error("Every user needs a personal home base.");
  for (const m of db.memberships) {
    fk(db.connections, m.connectionId);
    fk(db.users, m.userId);
  }
  unique(
    db.memberships.map((m) => `${m.connectionId}:${m.userId}`),
    "membership",
  );
  for (const base of db.connections.filter((b) => b.personalOwnerId)) {
    const people = db.memberships.filter((m) => m.connectionId === base.id);
    if (people.length !== 1 || people[0]!.userId !== base.personalOwnerId)
      throw new Error(
        "A personal home base has exactly its owner's membership.",
      );
  }
  for (const s of db.subjects) {
    fk(db.subjectTemplates, s.templateId);
    fk(db.users, s.ownerUserId);
  }
  for (const a of db.activities) {
    fk(db.activityTemplates, a.templateId);
    fk(db.users, a.creatorUserId);
    fk(db.users, a.personalOwnerId);
    fk(db.connections, a.connectionId);
    if ((a.personalOwnerId === null) === (a.connectionId === null))
      throw new Error("An activity needs exactly one owner scope.");
    if (
      a.connectionId &&
      db.connections.find((b) => b.id === a.connectionId)!.personalOwnerId
    )
      throw new Error("Personal activities use their personal owner scope.");
    if (a.personalOwnerId && a.creatorUserId !== a.personalOwnerId)
      throw new Error("A personal activity must be created by its owner.");
    if (a.connectionId && !inConnection(a.connectionId, a.creatorUserId))
      throw new Error("Activity creator must belong to its connection.");
  }
  for (const l of db.activitySubjects) {
    fk(db.activities, l.activityId);
    fk(db.subjects, l.subjectId);
  }
  unique(
    db.activitySubjects.map((l) => `${l.activityId}:${l.subjectId}`),
    "activity subject",
  );
  for (const p of db.participations) {
    fk(db.activities, p.activityId);
    fk(db.users, p.userId);
    const a = db.activities.find((a) => a.id === p.activityId)!;
    if (
      a.connectionId
        ? !inConnection(a.connectionId, p.userId)
        : a.personalOwnerId !== p.userId
    )
      throw new Error("Participation is outside the activity owner scope.");
  }
  unique(
    db.participations.map((p) => `${p.activityId}:${p.userId}`),
    "participation",
  );
  for (const milestone of db.milestones) {
    fk(db.activities, milestone.activityId);
    fk(db.milestones, milestone.parentId);
    fk(db.rewards, milestone.rewardId);
    const parent = db.milestones.find((m) => m.id === milestone.parentId)!;
    if (parent.activityId !== milestone.activityId)
      throw new Error("Milestone parent belongs to another activity.");
    if (milestone.kind === "join") {
      if (
        milestone.parentId !== milestone.id ||
        milestone.rewardId ||
        milestone.policy !== "open" ||
        milestone.startAt ||
        milestone.endAt ||
        milestone.quantity !== 1
      )
        throw new Error(
          "Milestone zero must be its own parent, unscheduled and without rewards.",
        );
    } else {
      milestoneInputSchema.parse({ ...milestone, itemId: null });
      const seen = new Set<string>([milestone.id]);
      let ancestor = parent;
      while (ancestor.kind !== "join") {
        if (seen.has(ancestor.id))
          throw new Error("Milestone hierarchy contains a cycle.");
        seen.add(ancestor.id);
        ancestor = db.milestones.find((m) => m.id === ancestor.parentId)!;
        if (!ancestor) throw new Error("Milestone parent is missing.");
      }
    }
  }
  for (const activity of db.activities)
    if (
      db.milestones.filter(
        (m) => m.activityId === activity.id && m.kind === "join",
      ).length !== 1
    )
      throw new Error("An activity needs exactly one milestone zero.");
  unique(
    db.milestones.filter((m) => m.rewardId).map((m) => m.rewardId!),
    "milestone reward",
  );
  for (const reward of db.rewards) {
    fk(db.connections, reward.homebaseId);
    fk(db.rewardItems, reward.itemId);
    unique(reward.requiredUserIds, "reward participant");
    const milestone = db.milestones.find((m) => m.rewardId === reward.id);
    if (!milestone)
      throw new Error("Reward must be assigned to exactly one milestone.");
    const activity = db.activities.find((a) => a.id === milestone.activityId)!;
    const homebase =
      activity.connectionId ??
      db.connections.find(
        (b) => b.personalOwnerId === activity.personalOwnerId,
      )!.id;
    if (reward.homebaseId !== homebase)
      throw new Error("Reward belongs to another home base.");
    for (const userId of reward.requiredUserIds) {
      fk(db.users, userId);
      if (
        !inConnection(reward.homebaseId, userId) ||
        !db.participations.some(
          (p) => p.activityId === activity.id && p.userId === userId,
        )
      )
        throw new Error("Reward requires someone outside the activity.");
    }
  }
  for (const l of db.logs) {
    fk(db.users, l.authorUserId);
    fk(db.subjects, l.subjectId);
    fk(db.milestones, l.milestoneId);
    if (l.milestoneId) {
      const milestone = db.milestones.find((m) => m.id === l.milestoneId)!;
      const activity = db.activities.find(
        (a) => a.id === milestone.activityId,
      )!;
      if (
        !db.participations.some(
          (p) => p.activityId === activity.id && p.userId === l.authorUserId,
        )
      )
        throw new Error("Log author is outside the milestone activity.");
      if (
        l.quantity !== milestone.quantity ||
        l.unit !== activity.unit ||
        l.category !== activity.category
      )
        throw new Error("Log facts differ from its milestone.");
      if (Date.parse(l.occurredAt) > Date.parse(l.createdAt))
        throw new Error("Log occurrence cannot follow submission.");
      if (
        (milestone.policy === "paced" &&
          milestone.startAt &&
          Date.parse(l.createdAt) < Date.parse(milestone.startAt)) ||
        (milestone.policy !== "open" &&
          milestone.endAt &&
          Date.parse(l.createdAt) > Date.parse(milestone.endAt))
      )
        throw new Error("Log submission is outside the milestone schedule.");
      const credits = db.contributions.filter((c) => c.logId === l.id);
      if (milestone.kind === "join" || !l.isSuccess) {
        if (credits.length)
          throw new Error("Join/failure logs cannot grant progress.");
      } else if (
        credits.length !== 1 ||
        db.participations.find((p) => p.id === credits[0]!.participationId)
          ?.activityId !== activity.id
      )
        throw new Error(
          "Successful milestone log must credit exactly its own activity.",
        );
      if (
        activity.connectionId &&
        !db.logShares.some(
          (share) =>
            share.logId === l.id &&
            share.connectionId === activity.connectionId,
        )
      )
        throw new Error("Milestone log is missing its home-base audience.");
    }
  }
  unique(
    db.logs
      .filter((l) => l.milestoneId && l.isSuccess)
      .map((l) => `${l.milestoneId}:${l.authorUserId}`),
    "milestone completion per user",
  );
  for (const reward of db.rewards) {
    const milestone = db.milestones.find((m) => m.rewardId === reward.id)!;
    const complete = reward.requiredUserIds.every((userId) =>
      db.logs.some(
        (l) =>
          l.milestoneId === milestone.id &&
          l.authorUserId === userId &&
          l.isSuccess,
      ),
    );
    if (Boolean(reward.obtainedAt) !== complete)
      throw new Error(
        "Reward obtained state differs from its required completions.",
      );
    if (
      reward.obtainedAt &&
      reward.requiredUserIds.some(
        (userId) =>
          !db.logs.some(
            (l) =>
              l.milestoneId === milestone.id &&
              l.authorUserId === userId &&
              l.isSuccess &&
              Date.parse(l.createdAt) <= Date.parse(reward.obtainedAt!),
          ),
      )
    )
      throw new Error("Reward predates a required completion.");
  }
  for (const person of db.participations) {
    const root = db.milestones.find(
      (m) => m.activityId === person.activityId && m.kind === "join",
    )!;
    const decisions = db.logs.filter(
      (l) => l.milestoneId === root.id && l.authorUserId === person.userId,
    );
    const latest = decisions.at(-1);
    if (
      person.status === "invited"
        ? decisions.length > 0
        : person.status === "left"
          ? !latest || latest.isSuccess
          : !latest?.isSuccess
    )
      throw new Error("Participation status differs from milestone zero logs.");
    // Replay this person's append-only milestone history. Importing cannot
    // bypass the same join/leave and once-only rules enforced by commands.
    let joined = false;
    let declined = false;
    let lastDecisionTime = -Infinity;
    const succeeded = new Set<string>();
    for (const log of db.logs.filter(
      (l) =>
        l.authorUserId === person.userId &&
        l.milestoneId &&
        db.milestones.find((m) => m.id === l.milestoneId)?.activityId ===
          person.activityId,
    )) {
      const milestone = db.milestones.find((m) => m.id === log.milestoneId)!;
      if (Date.parse(log.createdAt) < Date.parse(milestone.createdAt))
        throw new Error("Log predates milestone creation.");
      if (milestone.kind === "join") {
        if (!log.isSuccess && declined)
          throw new Error("Duplicate leave/decline decision.");
        if (Date.parse(log.createdAt) < lastDecisionTime)
          throw new Error("Participation decisions are out of order.");
        joined = log.isSuccess;
        declined = !log.isSuccess;
        lastDecisionTime = Date.parse(log.createdAt);
      } else {
        if (!joined || Date.parse(log.createdAt) < lastDecisionTime)
          throw new Error(
            "Achievement was recorded outside joined participation.",
          );
        if (succeeded.has(milestone.id))
          throw new Error("Outcome follows a completed milestone.");
        if (log.isSuccess) succeeded.add(milestone.id);
      }
    }
  }
  unique(
    db.logs
      .filter((l) => l.externalKey !== null)
      .map((l) => `${l.authorUserId}:${l.origin}:${l.externalKey}`),
    "trigger request key",
  );
  for (const s of db.logShares) {
    fk(db.logs, s.logId);
    fk(db.connections, s.connectionId);
    fk(db.users, s.sharedByUserId);
    const l = db.logs.find((l) => l.id === s.logId)!;
    if (
      s.sharedByUserId !== l.authorUserId ||
      !inConnection(s.connectionId, l.authorUserId)
    )
      throw new Error("Log audience is outside its author's connections.");
  }
  unique(
    db.logShares.map((s) => `${s.logId}:${s.connectionId}`),
    "log share",
  );
  for (const c of db.contributions) {
    fk(db.logs, c.logId);
    fk(db.participations, c.participationId);
    const p = db.participations.find((p) => p.id === c.participationId)!;
    const l = db.logs.find((l) => l.id === c.logId)!;
    const a = db.activities.find((a) => a.id === p.activityId)!;
    if (p.userId !== l.authorUserId)
      throw new Error("A contribution must credit its log's author.");
    if (
      a.category !== l.category ||
      (a.progressMode !== "sessions" && a.unit !== l.unit)
    )
      throw new Error("Contribution has incompatible category or units.");
    if (c.amount !== (a.progressMode === "sessions" ? 1 : l.quantity))
      throw new Error(
        "Contribution amount differs from the activity's interpretation.",
      );
    if (
      a.connectionId &&
      !db.logShares.some(
        (s) => s.logId === l.id && s.connectionId === a.connectionId,
      )
    )
      throw new Error("Shared contribution is missing its audience.");
  }
  unique(
    db.contributions.map((c) => `${c.logId}:${c.participationId}`),
    "log contribution",
  );
  for (const e of db.events) {
    fk(db.users, e.actorUserId);
    fk(
      e.entityType === "milestone"
        ? db.milestones
        : e.entityType === "reward"
          ? db.rewards
          : e.entityType === "log"
            ? db.logs
            : e.entityType === "subject"
              ? db.subjects
              : db.activities,
      e.entityId,
    );
  }
  for (const d of db.deliveries) {
    fk(db.events, d.eventId);
    fk(db.users, d.recipientUserId);
    fk(db.connections, d.connectionId);
    if (d.connectionId && !inConnection(d.connectionId, d.recipientUserId))
      throw new Error("Event delivered outside its connection.");
  }
  unique(
    db.deliveries.map((d) => `${d.eventId}:${d.recipientUserId}`),
    "event delivery",
  );
  return db;
}

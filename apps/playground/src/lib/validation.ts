import { z } from "zod";
import type { Database } from "./types.ts";
import { migrateDemoIdentity } from "./migrations.ts";
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
export const logInputSchema = z.object({
  authorUserId: key,
  subjectId: key.nullable(),
  category,
  title: z.string().trim().min(1).max(500),
  quantity: z.number().positive().finite(),
  unit: key,
  durationMinutes: z.number().nonnegative().finite(),
  occurredAt: date,
  origin,
  externalKey: key.nullable().optional(),
  activityIds: z.array(key),
  connectionIds: z.array(key),
});
const databaseSchema = z.object({
  version: z.literal(1),
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
  connections: rows(z.object({ id: key, name: key })),
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
  logs: rows(
    z.object({
      id: key,
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
      entityType: z.enum(["subject", "activity", "log"]),
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
  const db = migrateDemoIdentity(databaseSchema.parse(input));
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
  for (const m of db.memberships) {
    fk(db.connections, m.connectionId);
    fk(db.users, m.userId);
  }
  unique(
    db.memberships.map((m) => `${m.connectionId}:${m.userId}`),
    "membership",
  );
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
  for (const l of db.logs) {
    fk(db.users, l.authorUserId);
    fk(db.subjects, l.subjectId);
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
      e.entityType === "log"
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

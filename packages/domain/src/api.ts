import { z } from "zod";
import { meadowGridSize, starterOakItemId } from "./garden.ts";
import { WORLD_HEIGHT, WORLD_WIDTH } from "./meadow-terrain.ts";
import {
  databaseSchema,
  logInputSchema,
  milestoneInputSchema,
} from "./validation.ts";

const id = z.string().min(1).max(200);
const name = z.string().trim().min(1).max(200);
const email = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const password = z.string().min(12).max(128);
export const registerSchema = z.strictObject({
  name,
  email,
  password,
  inviteCode: z.string().trim().max(100).optional(),
});
export const loginSchema = z.strictObject({ email, password });
export const createHomebaseSchema = z.strictObject({ name });
export const plantStarterOakSchema = z.strictObject({
  x: z
    .int()
    .min(0)
    .max(WORLD_WIDTH - 1)
    .multipleOf(meadowGridSize),
  y: z
    .int()
    .min(0)
    .max(WORLD_HEIGHT - 1)
    .multipleOf(meadowGridSize),
});
export const homebaseGardenSchema = z.strictObject({
  // The starter oak at its current stage; an upgrade can decorate it.
  oak: plantStarterOakSchema
    .extend({
      itemId: z.string().describe(`"${starterOakItemId}" until upgraded`),
    })
    .nullable(),
});
// Place an earned garden object, or move any placed one. Free for members.
export const placeGardenObjectSchema = plantStarterOakSchema;
const hasChanges = (value: object) =>
  Object.values(value).some((field) => field !== undefined);
export const updateHomebaseSchema = createHomebaseSchema;
export const updateActivitySchema = z
  .strictObject({
    name: name.optional(),
    description: z.string().max(2000).optional(),
    target: z.number().positive().finite().optional(),
  })
  .refine(hasChanges, "Provide at least one field to update.");
// Validate schedules against the merged saved milestone in the command engine.
export const updateMilestoneSchema = z
  .strictObject({ ...milestoneInputSchema.shape })
  .omit({ activityId: true })
  .partial()
  .refine(hasChanges, "Provide at least one field to update.");
export const joinHomebaseSchema = z.strictObject({
  inviteCode: z.string().min(20).max(100),
});
export const createSubjectSchema = z.strictObject({
  templateId: id,
  title: name,
  metadata: z.record(id, z.string().max(2000)).default({}),
});
export const createActivitySchema = z.strictObject({
  templateId: id,
  name,
  description: z.string().max(2000).default(""),
  connectionId: id,
  subjectIds: z.array(id).max(100).default([]),
  target: z.number().positive().finite(),
});
export const linkSubjectSchema = z.strictObject({ subjectId: id });
export const participationSchema = z.strictObject({
  target: z.number().positive().finite(),
});
// Keep schedule refinements from the shared domain validator.
export const createMilestoneSchema = milestoneInputSchema.strict();
export const createLogSchema = logInputSchema
  .omit({ authorUserId: true })
  .extend({
    occurredAt: logInputSchema.shape.occurredAt
      .optional()
      .describe("Omit for an immediate check-in recorded at server time."),
  });
export const shareLogSchema = z.strictObject({
  connectionIds: z.array(id).max(100),
});
export const publicUserSchema = databaseSchema.shape.users.element.omit({
  email: true,
});
export const sessionSchema = z.object({
  token: z.string(),
  expiresAt: z.iso.datetime(),
  user: databaseSchema.shape.users.element,
});
export const mutationSchema = z.object({
  entityId: id,
  duplicate: z.boolean(),
});
export const homebaseSchema = databaseSchema.shape.connections.element.extend({
  inviteCode: z.string(),
  memberIds: z.array(id),
});
export const stateSchema = databaseSchema.extend({
  users: z.array(publicUserSchema),
  serverTime: z.iso
    .datetime()
    .optional()
    .describe("Server time for this state snapshot."),
});
export const errorSchema = z.object({
  statusCode: z.number(),
  message: z.string(),
  issues: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional(),
});
const count = z.number().int().nonnegative();
// Something an upgrade could build on: a garden object, or a planned reward.
export const precursorCandidateSchema = z.object({
  kind: z.enum(["object", "reward"]),
  id,
  origin: z.enum(["reward", "starter"]),
  placed: z.boolean(),
  milestoneName: z.string().nullable(),
});
// What each catalog item needs in one home base's garden right now.
export const rewardStatusSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("place") }),
  z.object({
    kind: z.literal("ready"),
    precursorId: id,
    candidates: z.array(precursorCandidateSchema),
  }),
  z.object({
    kind: z.literal("queued"),
    precursorId: id,
    candidates: z.array(precursorCandidateSchema),
  }),
  z.object({
    kind: z.literal("locked"),
    precursorId: id,
    chain: z.array(id),
  }),
]);
export const homebaseRewardsSchema = z.object({
  homebaseId: id,
  items: z.array(
    z.object({
      itemId: id,
      name: z.string(),
      category: z.string(),
      status: rewardStatusSchema,
      inGarden: count,
      planned: count,
      waiting: count,
    }),
  ),
  builds: z.array(
    z.object({
      id,
      name: z.string(),
      stages: z.array(id),
      reached: count,
    }),
  ),
});
export type ApiState = z.infer<typeof stateSchema>;
export type HomebaseRewards = z.infer<typeof homebaseRewardsSchema>;
export type RewardStatusView = z.infer<typeof rewardStatusSchema>;
export type PrecursorCandidateView = z.infer<typeof precursorCandidateSchema>;
export type PlaceGardenObjectInput = z.input<typeof placeGardenObjectSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type MutationResult = z.infer<typeof mutationSchema>;
export type ApiHomebase = z.infer<typeof homebaseSchema>;
export type HomebaseGarden = z.infer<typeof homebaseGardenSchema>;
export type PlantStarterOakInput = z.input<typeof plantStarterOakSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type CreateSubjectInput = z.input<typeof createSubjectSchema>;
export type CreateActivityInput = z.input<typeof createActivitySchema>;
export type CreateMilestoneInput = z.input<typeof createMilestoneSchema>;
export type UpdateActivityInput = z.input<typeof updateActivitySchema>;
export type UpdateMilestoneInput = z.input<typeof updateMilestoneSchema>;
export type CreateLogInput = z.input<typeof createLogSchema>;

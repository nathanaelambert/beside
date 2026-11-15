import { z } from "zod";
import { rarityOrder } from "./shop.ts";
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
  oak: plantStarterOakSchema
    .extend({ itemId: z.literal(starterOakItemId) })
    .nullable(),
});
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
export const buyDecorationSchema = z.strictObject({
  homebaseId: id,
  itemId: id,
  x: z.int().describe("Bottom-centre anchor in meadow pixels, multiple of 8."),
  y: z.int().describe("Bottom-centre anchor in meadow pixels, multiple of 8."),
  externalKey: id
    .optional()
    .describe("Reuse when retrying so one purchase is never charged twice."),
});
export const moveDecorationSchema = z.strictObject({
  x: z.int().describe("New bottom-centre anchor, multiple of 8."),
  y: z.int().describe("New bottom-centre anchor, multiple of 8."),
});
const rarity = z.enum(rarityOrder as [string, ...string[]]);
export const shopSchema = z.object({
  currency: z.object({
    id: z.string(),
    singular: z.string(),
    plural: z.string(),
  }),
  earning: z.object({
    checkIn: z.int().describe("Acorns per successful achievement check-in."),
    togetherPerPerson: z
      .int()
      .describe("Bonus per roster member once everyone has checked in."),
  }),
  tiers: z.array(
    z.object({
      id: rarity,
      name: z.string(),
      price: z.int(),
      limitPerHomebase: z.int().nullable(),
      color: z.string(),
    }),
  ),
  listings: z.array(
    z.object({
      itemId: id,
      rarity,
      price: z.int(),
      limitPerHomebase: z.int().nullable(),
    }),
  ),
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
export type ApiState = z.infer<typeof stateSchema>;
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
export type BuyDecorationInput = z.input<typeof buyDecorationSchema>;
export type MoveDecorationInput = z.input<typeof moveDecorationSchema>;
export type Shop = z.infer<typeof shopSchema>;

import { z } from "zod";
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
export const createLogSchema = logInputSchema.omit({ authorUserId: true });
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
export type RegisterInput = z.input<typeof registerSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type CreateSubjectInput = z.input<typeof createSubjectSchema>;
export type CreateActivityInput = z.input<typeof createActivitySchema>;
export type CreateMilestoneInput = z.input<typeof createMilestoneSchema>;
export type CreateLogInput = z.input<typeof createLogSchema>;

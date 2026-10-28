import { z } from "zod";
import type { OpenAPIObject } from "@nestjs/swagger";
import { databaseSchema } from "@beside/domain/validation";
import * as api from "@beside/domain/api";

export const schemas = {
  Register: api.registerSchema,
  Login: api.loginSchema,
  Session: api.sessionSchema,
  User: databaseSchema.shape.users.element,
  PublicUser: api.publicUserSchema,
  CreateHomebase: api.createHomebaseSchema,
  UpdateHomebase: api.updateHomebaseSchema,
  UpdateActivity: api.updateActivitySchema,
  UpdateMilestone: api.updateMilestoneSchema,
  JoinHomebase: api.joinHomebaseSchema,
  Homebase: api.homebaseSchema,
  CreateSubject: api.createSubjectSchema,
  CreateActivity: api.createActivitySchema,
  LinkSubject: api.linkSubjectSchema,
  UpdateParticipation: api.participationSchema,
  CreateMilestone: api.createMilestoneSchema,
  CreateLog: api.createLogSchema,
  ShareLog: api.shareLogSchema,
  Mutation: api.mutationSchema,
  State: api.stateSchema,
  Error: api.errorSchema,
  Subject: databaseSchema.shape.subjects.element,
  Activity: databaseSchema.shape.activities.element,
  Milestone: databaseSchema.shape.milestones.element,
  Log: databaseSchema.shape.logs.element,
  Reward: databaseSchema.shape.rewards.element,
  Event: databaseSchema.shape.events.element,
  Templates: z.object({
    subjectTemplates: databaseSchema.shape.subjectTemplates,
    activityTemplates: databaseSchema.shape.activityTemplates,
  }),
  RewardItem: databaseSchema.shape.rewardItems.unwrap().element,
  Health: z.object({ status: z.literal("ok") }),
  Readiness: z.object({
    status: z.literal("ok"),
    database: z.literal("connected"),
  }),
};
type SchemaObject = NonNullable<
  NonNullable<OpenAPIObject["components"]>["schemas"]
>[string];
export function openApiSchema(schema: z.ZodType): SchemaObject {
  const { $schema: _, ...json } = z.toJSONSchema(schema, {
    target: "openapi-3.0",
    io: "input",
  });
  return json as SchemaObject;
}
export const ref = (name: keyof typeof schemas) => ({
  $ref: `#/components/schemas/${name}`,
});
export const list = (name: keyof typeof schemas): SchemaObject => ({
  type: "array",
  items: ref(name),
});

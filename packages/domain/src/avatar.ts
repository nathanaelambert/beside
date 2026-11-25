import { z } from "zod";
import { avatarOptions } from "./avatar-options.ts";

export const avatarAppearanceSchema = z.strictObject({
  version: z.literal(1),
  skin: z.enum(avatarOptions.skin),
  hair: z.enum(avatarOptions.hair),
  hairColor: z.enum(avatarOptions.hairColor),
  glasses: z.enum(avatarOptions.glasses),
  outfit: z.enum(avatarOptions.outfit),
});

export type AvatarAppearance = z.infer<typeof avatarAppearanceSchema>;

import type { AvatarAppearance } from "./avatar.ts";

export const avatarOptions = {
  skin: ["porcelain", "sand", "bronze", "deep"],
  hair: ["bald", "cropped", "swept", "curly"],
  hairColor: ["espresso", "chestnut", "copper"],
  glasses: ["none", "round", "square"],
  outfit: ["moss-jacket", "indigo-jacket", "clay-sweater", "ochre-sweater"],
} as const;

function pick<T>(options: readonly [T, ...T[]]): T {
  return options[Math.floor(Math.random() * options.length)]!;
}

export function randomAvatarAppearance(): AvatarAppearance {
  return {
    version: 1,
    skin: pick<AvatarAppearance["skin"]>(avatarOptions.skin),
    hair: pick<AvatarAppearance["hair"]>(avatarOptions.hair),
    hairColor: pick<AvatarAppearance["hairColor"]>(avatarOptions.hairColor),
    glasses: pick<AvatarAppearance["glasses"]>(avatarOptions.glasses),
    outfit: pick<AvatarAppearance["outfit"]>(avatarOptions.outfit),
  };
}

import { memberAvatarStyles, type Avatar } from "./avatars"
import { showcaseAvatarFrames } from "./showcaseAvatarArt"
import { showcaseCompanionFrames } from "./showcaseCompanionArt"

const portraits: Readonly<Partial<Record<string, Avatar["frames"]>>> = {
  ...showcaseAvatarFrames,
  ...showcaseCompanionFrames,
}

// Member mapping preserves each source frame reference even when the key, name,
// position and animation phase are supplied by a real membership.
const illustrations = new Map(
  memberAvatarStyles.map(({ key, frames }) => [frames, portraits[key] ?? frames]),
)

/** Swap the detailed art while preserving the original world rectangle and timing. */
export function detailedAvatar(avatar: Avatar): Avatar {
  const frames = illustrations.get(avatar.frames)
  return frames ? { ...avatar, frames } : avatar
}

import { avatarFrames, memberAvatarStyles, type Avatar } from "./avatars"
import { memberPaint, paintAvatar } from "./detailedAvatarArt"

// Member mapping preserves each source frame reference even when the key, name,
// position and animation phase are supplied by a real membership.
const illustrations = new Map(
  memberAvatarStyles.map(({ key, frames }) => [
    frames,
    avatarFrames(paintAvatar(memberPaint[key as keyof typeof memberPaint]), 2),
  ]),
)

/** Hand-painted material planes, with the original logical size, mask and timing. */
export function detailedAvatar(avatar: Avatar): Avatar {
  const frames = illustrations.get(avatar.frames)
  return frames ? { ...avatar, frames } : avatar
}

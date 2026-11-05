import type { ApiHomebase, ApiState } from "@beside/api-client"

const preferredMembers = ["Nathanael Lambert", "Vaibhav Kapoor", "Pritesh Parmar"]

export function selectHomebase(
  bases: ApiHomebase[],
  users: ApiState["users"],
  connectionId?: string,
) {
  return (
    bases.find((base) => base.id === connectionId) ??
    bases.find((base) => base.name === "Project Beside") ??
    bases.find((base) =>
      preferredMembers.every((name) =>
        users.some((user) => user.name === name && base.memberIds.includes(user.id)),
      ),
    ) ??
    bases[0]
  )
}

export function memberInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .filter((_, index, parts) => index === 0 || index === parts.length - 1)
    .join("")
    .toUpperCase()
}

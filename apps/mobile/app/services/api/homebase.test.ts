import type { ApiHomebase, ApiState } from "@beside/api-client"

import { memberInitials, selectHomebase } from "./homebase"

const base = (id: string, name: string, memberIds: string[] = []): ApiHomebase => ({
  id,
  name,
  memberIds,
  inviteCode: "unused",
})
const people: ApiState["users"] = [
  { id: "n", name: "Nathanael Lambert", color: "blue" },
  { id: "v", name: "Vaibhav Kapoor", color: "blue" },
  { id: "p", name: "Pritesh Parmar", color: "blue" },
]

describe("home base selection", () => {
  const bases = [
    base("personal", "Personal"),
    base("project", "Project Beside"),
    base("friends", "Friends", ["n", "v", "p"]),
  ]
  it("opens Project Beside ahead of personal or matching-member bases", () => {
    expect(selectHomebase(bases, people)?.id).toBe("project")
  })
  it("honors an explicit connection and ignores stale connection IDs", () => {
    expect(selectHomebase(bases, people, "friends")?.id).toBe("friends")
    expect(selectHomebase(bases, people, "deleted")?.id).toBe("project")
  })
  it("uses the named members when Project Beside is absent, then the first base", () => {
    expect(selectHomebase([bases[0], bases[2]], people)?.id).toBe("friends")
    expect(selectHomebase([bases[0]], people)?.id).toBe("personal")
    expect(selectHomebase([], people)).toBeUndefined()
  })
})

it("uses first and last initials without missing-name artifacts", () => {
  expect(memberInitials("  Nathanael   Lambert ")).toBe("NL")
  expect(memberInitials("Mosaab El Emam")).toBe("ME")
  expect(memberInitials("Vaibhav")).toBe("V")
  expect(memberInitials("")).toBe("")
})

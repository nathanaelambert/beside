import { guestValidation, loginValidation, registerValidation } from "./validation"

it("requires a display name and a full invitation code, but no credentials", () => {
  const invite = "x".repeat(32)
  expect(guestValidation("  ", invite)).toBe("Enter your name.")
  expect(guestValidation("Juniper", "short")).toBe("Enter the full invite code from your host.")
  expect(guestValidation("x".repeat(201), invite)).toBe("Your name is too long.")
  expect(guestValidation(" Juniper ", ` ${invite} `)).toBe("")
})

it("requires a plausible email and a password without trimming the password", () => {
  expect(loginValidation("invalid", "example-password")).toBe("Enter a valid email address.")
  expect(loginValidation(" person@example.com ", "")).toBe("Enter your password.")
  expect(loginValidation(" person@example.com ", " password with spaces ")).toBe("")
})

it("checks registration fields against the API's rules", () => {
  expect(registerValidation("  ", "person@example.com", "long-enough-password")).toBe(
    "Enter your name.",
  )
  expect(registerValidation("Sam", "invalid", "long-enough-password")).toBe(
    "Enter a valid email address.",
  )
  expect(registerValidation("Sam", "person@example.com", "short")).toBe(
    "Use at least 12 characters for your password.",
  )
  expect(registerValidation("Sam", "person@example.com", "x".repeat(129))).toBe(
    "Use at most 128 characters for your password.",
  )
  expect(registerValidation("Sam", " person@example.com ", "long-enough-password")).toBe("")
})

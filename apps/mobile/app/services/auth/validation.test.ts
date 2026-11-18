import { loginValidation, registerValidation } from "./validation"

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

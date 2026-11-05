import { loginValidation } from "./validation"

it("requires a plausible email and a password without trimming the password", () => {
  expect(loginValidation("invalid", "example-password")).toBe("Enter a valid email address.")
  expect(loginValidation(" person@example.com ", "")).toBe("Enter your password.")
  expect(loginValidation(" person@example.com ", " password with spaces ")).toBe("")
})

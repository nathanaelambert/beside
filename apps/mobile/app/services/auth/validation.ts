// Mirrors the API's registerSchema/loginSchema in packages/domain/src/api.ts.
export const MIN_PASSWORD_LENGTH = 12
const MAX_PASSWORD_LENGTH = 128

function emailError(email: string): string {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "" : "Enter a valid email address."
}

export function loginValidation(email: string, password: string): string {
  const invalidEmail = emailError(email)
  if (invalidEmail) return invalidEmail
  if (!password) return "Enter your password."
  return ""
}

export function registerValidation(name: string, email: string, password: string): string {
  if (!name.trim()) return "Enter your name."
  const invalidEmail = emailError(email)
  if (invalidEmail) return invalidEmail
  if (password.length < MIN_PASSWORD_LENGTH)
    return `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`
  if (password.length > MAX_PASSWORD_LENGTH)
    return `Use at most ${MAX_PASSWORD_LENGTH} characters for your password.`
  return ""
}

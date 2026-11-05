export function loginValidation(email: string, password: string): string {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address."
  if (!password) return "Enter your password."
  return ""
}

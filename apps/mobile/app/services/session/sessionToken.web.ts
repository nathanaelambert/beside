const SESSION_KEY = "beside.session-token"

/**
 * Web: expo-secure-store has no browser implementation, so the token lives in
 * localStorage. Storage can be unavailable (private mode, blocked site data); reads
 * then behave as signed out instead of failing the whole restore.
 */
export const sessionToken = {
  get: async (): Promise<string | null> => {
    try {
      return window.localStorage.getItem(SESSION_KEY)
    } catch {
      return null
    }
  },
  set: async (token: string): Promise<void> => {
    window.localStorage.setItem(SESSION_KEY, token)
  },
  clear: async (): Promise<void> => {
    try {
      window.localStorage.removeItem(SESSION_KEY)
    } catch {
      // Nothing stored, nothing to clear.
    }
  },
}

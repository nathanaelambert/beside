import {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import * as SecureStore from "expo-secure-store"
import type { Session } from "@beside/api-client"

import { besideApi } from "@/services/api/beside"
import { remove } from "@/utils/storage"

type AuthUser = Session["user"]
const SESSION_KEY = "beside.session-token"

export type AuthContextType = {
  isAuthenticated: boolean
  isRestoring: boolean
  restoreError: string
  user: AuthUser | null
  completeSignIn: (session: Session) => Promise<void>
  retryRestore: () => void
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isRestoring, setIsRestoring] = useState(true)
  const [restoreError, setRestoreError] = useState("")
  const [restoreAttempt, setRestoreAttempt] = useState(0)

  useEffect(() => {
    let active = true
    // Remove the old Ignite fake token and persisted demo navigation.
    remove("AuthProvider.authToken")
    remove("AuthProvider.authEmail")
    remove("NAVIGATION_STATE")
    async function restore() {
      setIsRestoring(true)
      setRestoreError("")
      try {
        const token = await SecureStore.getItemAsync(SESSION_KEY)
        if (!active) return
        besideApi.setToken(token)
        if (token) {
          try {
            const profile = await besideApi.me()
            if (active) setUser(profile)
          } catch (error) {
            if (error instanceof Error && "status" in error && error.status === 401) {
              await SecureStore.deleteItemAsync(SESSION_KEY)
              besideApi.setToken(null)
            } else {
              throw error
            }
          }
        }
      } catch {
        if (active)
          setRestoreError("We couldn’t restore your session. Check your connection and try again.")
      } finally {
        if (active) setIsRestoring(false)
      }
    }
    void restore()
    return () => {
      active = false
    }
  }, [restoreAttempt])

  const completeSignIn = useCallback(async (session: Session) => {
    try {
      await SecureStore.setItemAsync(SESSION_KEY, session.token, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      })
    } catch {
      await besideApi.logout().catch(() => undefined)
      besideApi.setToken(null)
      throw new Error("We couldn’t securely save your session. Please try again.")
    }
    besideApi.setToken(session.token)
    setUser(session.user)
  }, [])

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY)
    await besideApi.logout().catch(() => undefined)
    besideApi.setToken(null)
    setUser(null)
    remove("NAVIGATION_STATE")
  }, [])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        isRestoring,
        restoreError,
        user,
        completeSignIn,
        retryRestore: () => setRestoreAttempt((attempt) => attempt + 1),
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within an AuthProvider")
  return context
}

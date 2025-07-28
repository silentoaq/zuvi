import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserCredentials {
  hasPropertyCredential: boolean
  hasCitizenCredential: boolean
  propertyCount: number
}

interface User {
  publicKey: string
  did: string
  credentials: UserCredentials
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user: User, token: string) =>
        set({
          user,
          token,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'zuvi-auth',
    }
  )
)
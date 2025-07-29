import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface CredentialStatus {
  twfido?: {
    exists: boolean
    address?: string
    data?: any
    expiry?: number
  }
  twland?: {
    exists: boolean
    attestations?: any[]
    count?: number
  }
}

interface User {
  publicKey: string
  credentialStatus: CredentialStatus
  isArbitrator?: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  
  setUser: (user: User) => void
  setToken: (token: string) => void
  updateCredentialStatus: (status: CredentialStatus) => void
  logout: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => 
        set({ 
          user, 
          isAuthenticated: true 
        }),

      setToken: (token) => 
        set({ token }),

      updateCredentialStatus: (status) => 
        set((state) => ({
          user: state.user ? {
            ...state.user,
            credentialStatus: {
              ...state.user.credentialStatus,
              ...status
            }
          } : null
        })),

      logout: () => 
        set({ 
          user: null, 
          token: null, 
          isAuthenticated: false,
          isLoading: false
        }),

      setLoading: (isLoading) => 
        set({ isLoading })
    }),
    {
      name: 'zuvi-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      }),
      skipHydration: false
    }
  )
)
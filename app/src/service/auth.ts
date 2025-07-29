import type { WalletAdapter } from '@solana/wallet-adapter-base'
import bs58 from 'bs58'
import { apiService } from './api'
import { useAuthStore } from '@/stores/authStore'

export class AuthService {
  private isAuthenticating = false
  private hasValidToken = false

  async authenticateWallet(wallet: WalletAdapter): Promise<void> {
    if (!wallet.publicKey || this.isAuthenticating || this.hasValidToken) {
      return
    }

    const { setLoading, setUser, setToken } = useAuthStore.getState()
    
    try {
      this.isAuthenticating = true
      setLoading(true)

      const publicKeyString = wallet.publicKey.toString()

      const { message } = await apiService.getSignMessage(publicKeyString)

      if (typeof (wallet as any).signMessage !== 'function') {
        throw new Error('錢包不支持訊息簽名')
      }

      const messageBytes = new TextEncoder().encode(message)
      const signatureBytes = await (wallet as any).signMessage(messageBytes)
      const signature = bs58.encode(signatureBytes)

      const loginResponse = await apiService.login(publicKeyString, signature, message)
      
      if (!loginResponse.success) {
        throw new Error('登入失敗')
      }

      localStorage.setItem('zuvi-auth-token', loginResponse.token)
      setToken(loginResponse.token)
      setUser(loginResponse.user)
      this.hasValidToken = true

    } catch (error) {
      console.error('認證失敗:', error)
      this.logout()
      throw error
    } finally {
      setLoading(false)
      this.isAuthenticating = false
    }
  }

  async refreshCredentials(): Promise<void> {
    const { updateCredentialStatus, setLoading } = useAuthStore.getState()
    
    try {
      setLoading(true)
      const { credentialStatus } = await apiService.getCredentials()
      updateCredentialStatus(credentialStatus)
    } catch (error) {
      console.error('更新憑證狀態失敗:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  async verifyExistingToken(): Promise<boolean> {
    if (this.isAuthenticating) return false

    const token = localStorage.getItem('zuvi-auth-token')
    if (!token) {
      this.hasValidToken = false
      return false
    }

    const { setUser, setToken, setLoading } = useAuthStore.getState()

    try {
      setLoading(true)
      const { valid, user } = await apiService.verifyToken()
      
      if (valid && user) {
        setToken(token)
        setUser(user)
        this.hasValidToken = true
        return true
      } else {
        this.logout()
        return false
      }
    } catch (error) {
      console.error('驗證 token 失敗:', error)
      this.logout()
      return false
    } finally {
      setLoading(false)
    }
  }

  logout(): void {
    const { logout } = useAuthStore.getState()
    localStorage.removeItem('zuvi-auth-token')
    logout()
    this.isAuthenticating = false
    this.hasValidToken = false
  }

  isCurrentlyAuthenticated(): boolean {
    return this.hasValidToken || useAuthStore.getState().isAuthenticated
  }
}

export const authService = new AuthService()
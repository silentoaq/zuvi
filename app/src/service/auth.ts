import type { WalletAdapter } from '@solana/wallet-adapter-base'
import bs58 from 'bs58'
import { apiService } from './api'
import { useAuthStore } from '@/stores/authStore'

export class AuthService {
  private isAuthenticating = false
  private _hasValidToken = false
  private isInitialized = false
  private isVerifying = false

  async authenticateWallet(wallet: WalletAdapter): Promise<void> {
    if (!wallet.publicKey) {
      return
    }
    
    if (this.isAuthenticating || this.isVerifying) {
      return
    }
    
    if (this._hasValidToken) {
      return
    }

    // 再次檢查 localStorage，避免競態條件
    if (this.hasStoredToken()) {
      const isValid = await this.verifyExistingToken()
      if (isValid) {
        return
      }
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
      this._hasValidToken = true

    } catch (error) {
      console.error('[AuthService] Authentication failed:', error)
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
    if (this.isAuthenticating || this.isVerifying) {
      return false
    }

    const token = localStorage.getItem('zuvi-auth-token')
    
    if (!token) {
      this._hasValidToken = false
      return false
    }

    const { setUser, setToken, setLoading } = useAuthStore.getState()

    try {
      this.isVerifying = true
      setLoading(true)
      
      const { valid, user } = await apiService.verifyToken()
      
      if (valid && user) {
        setToken(token)
        setUser(user)
        this._hasValidToken = true
        return true
      } else {
        this.logout()
        return false
      }
    } catch (error) {
      console.error('[AuthService] Token verification error:', error)
      this.logout()
      return false
    } finally {
      setLoading(false)
      this.isVerifying = false
    }
  }

  logout(): void {
    // 如果正在驗證，不要清除 token
    if (this.isVerifying) {
      return
    }
    
    const { logout } = useAuthStore.getState()
    localStorage.removeItem('zuvi-auth-token')
    logout()
    this.isAuthenticating = false
    this._hasValidToken = false
  }

  // 直接檢查 localStorage 的 token
  hasStoredToken(): boolean {
    return !!localStorage.getItem('zuvi-auth-token')
  }

  // 檢查是否有有效的 token（記憶體中）
  hasValidToken(): boolean {
    return this._hasValidToken
  }

  isCurrentlyAuthenticated(): boolean {
    // 優先檢查 localStorage，再檢查記憶體狀態
    return this.hasStoredToken() || this._hasValidToken || useAuthStore.getState().isAuthenticated
  }

  // 確保初始化只執行一次
  async initializeAuth(): Promise<void> {
    if (this.isInitialized) {
      return
    }
    
    this.isInitialized = true
    
    if (this.hasStoredToken()) {
      await this.verifyExistingToken()
    }
  }
}

export const authService = new AuthService()
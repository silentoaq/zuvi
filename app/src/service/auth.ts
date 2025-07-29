import type { WalletAdapter } from '@solana/wallet-adapter-base'
import bs58 from 'bs58'
import { apiService } from './api'
import { useAuthStore } from '@/stores/authStore'

export class AuthService {
  async authenticateWallet(wallet: WalletAdapter): Promise<void> {
    if (!wallet.publicKey) {
      throw new Error('錢包未連接')
    }

    const { setLoading, setUser, setToken } = useAuthStore.getState()
    
    try {
      setLoading(true)

      const publicKeyString = wallet.publicKey.toString()
      console.log('開始認證流程，錢包地址:', publicKeyString)

      const { message } = await apiService.getSignMessage(publicKeyString)
      console.log('獲取簽名訊息:', message)

      if (typeof (wallet as any).signMessage !== 'function') {
        throw new Error('錢包不支持訊息簽名')
      }

      const messageBytes = new TextEncoder().encode(message)
      const signatureBytes = await (wallet as any).signMessage(messageBytes)
      const signature = bs58.encode(signatureBytes)

      console.log('錢包簽名完成')

      const loginResponse = await apiService.login(publicKeyString, signature, message)
      
      if (!loginResponse.success) {
        throw new Error('登入失敗')
      }

      localStorage.setItem('zuvi-auth-token', loginResponse.token)
      setToken(loginResponse.token)
      setUser(loginResponse.user)

      console.log('認證成功:', loginResponse.user)

    } catch (error) {
      console.error('認證失敗:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  async refreshCredentials(): Promise<void> {
    const { updateCredentialStatus, setLoading } = useAuthStore.getState()
    
    try {
      setLoading(true)
      const { credentialStatus } = await apiService.getCredentials()
      updateCredentialStatus(credentialStatus)
      console.log('憑證狀態已更新:', credentialStatus)
    } catch (error) {
      console.error('更新憑證狀態失敗:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  async verifyExistingToken(): Promise<boolean> {
    const token = localStorage.getItem('zuvi-auth-token')
    if (!token) return false

    const { setUser, setToken, setLoading, logout } = useAuthStore.getState()

    try {
      setLoading(true)
      const { valid, user } = await apiService.verifyToken()
      
      if (valid && user) {
        setToken(token)
        setUser(user)
        console.log('現有 token 驗證成功')
        return true
      } else {
        logout()
        localStorage.removeItem('zuvi-auth-token')
        return false
      }
    } catch (error) {
      console.error('驗證 token 失敗:', error)
      logout()
      localStorage.removeItem('zuvi-auth-token')
      return false
    } finally {
      setLoading(false)
    }
  }

  logout(): void {
    const { logout } = useAuthStore.getState()
    localStorage.removeItem('zuvi-auth-token')
    logout()
    console.log('用戶已登出')
  }
}

export const authService = new AuthService()
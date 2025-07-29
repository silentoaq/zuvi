import { useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { authService } from '@/service/auth'
import { useAuthStore } from '@/stores/authStore'

export const useWalletAuth = () => {
  const { connected, wallet, disconnect } = useWallet()
  const { isAuthenticated, user } = useAuthStore()

  const authenticate = useCallback(async () => {
    if (!wallet || !connected) return

    try {
      await authService.authenticateWallet(wallet.adapter)
    } catch (error) {
      console.error('認證過程中發生錯誤:', error)
      disconnect()
    }
  }, [wallet, connected, disconnect])

  const handleDisconnect = useCallback(() => {
    disconnect()
    authService.logout()
  }, [disconnect])

  const refreshCredentials = useCallback(async () => {
    if (!isAuthenticated) return
    
    try {
      await authService.refreshCredentials()
    } catch (error) {
      console.error('刷新憑證失敗:', error)
    }
  }, [isAuthenticated])

  useEffect(() => {
    const initAuth = async () => {
      if (connected && !isAuthenticated) {
        const tokenValid = await authService.verifyExistingToken()
        if (!tokenValid && wallet) {
          await authenticate()
        }
      }
    }

    initAuth()
  }, [connected, isAuthenticated, authenticate, wallet])

  useEffect(() => {
    if (!connected && isAuthenticated) {
      authService.logout()
    }
  }, [connected, isAuthenticated])

  return {
    authenticate,
    handleDisconnect,
    refreshCredentials,
    isAuthenticated,
    user
  }
}
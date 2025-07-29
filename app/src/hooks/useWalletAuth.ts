import { useEffect, useCallback, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { authService } from '@/service/auth'
import { useAuthStore } from '@/stores/authStore'

// 全域狀態
let globalInitialized = false

export const useWalletAuth = () => {
  const { connected, wallet, disconnect } = useWallet()
  const { isAuthenticated, user } = useAuthStore()
  const authCheckDelayRef = useRef<NodeJS.Timeout | null>(null)
  const isAuthenticatingRef = useRef(false)

  const authenticate = useCallback(async () => {
    if (!wallet || !connected || isAuthenticatingRef.current) return

    try {
      isAuthenticatingRef.current = true
      await authService.authenticateWallet(wallet.adapter)
    } catch (error) {
      console.error('認證過程中發生錯誤:', error)
      disconnect()
    } finally {
      isAuthenticatingRef.current = false
    }
  }, [wallet, connected, disconnect])

  const handleDisconnect = useCallback(() => {
    if (authCheckDelayRef.current) {
      clearTimeout(authCheckDelayRef.current)
    }
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

  // 初始化檢查 - 只執行一次
  useEffect(() => {
    if (globalInitialized) return
    globalInitialized = true
    
    // 延遲執行，確保 localStorage 和 Zustand 都準備好
    setTimeout(async () => {
      if (authService.hasStoredToken()) {
        try {
          await authService.initializeAuth()
        } catch (error) {
          console.error('[Auth] Initial verification failed:', error)
        }
      }
    }, 100)
  }, [])

  // 錢包連接狀態管理
  useEffect(() => {
    if (authCheckDelayRef.current) {
      clearTimeout(authCheckDelayRef.current)
      authCheckDelayRef.current = null
    }

    // 錢包未連接
    if (!connected || !wallet) {
      return
    }

    // 如果已經認證，不需要重新認證
    if (isAuthenticated || authService.hasValidToken()) {
      return
    }

    // 如果有 stored token，等待初始化完成
    if (authService.hasStoredToken()) {
      return
    }

    // 沒有 token，需要新的認證
    authCheckDelayRef.current = setTimeout(() => {
      if (!isAuthenticated && !authService.hasValidToken() && !authService.hasStoredToken()) {
        authenticate()
      }
    }, 500)

    return () => {
      if (authCheckDelayRef.current) {
        clearTimeout(authCheckDelayRef.current)
        authCheckDelayRef.current = null
      }
    }
  }, [connected, wallet, isAuthenticated, authenticate])

  // 單獨處理斷開連接
  useEffect(() => {
    if (!connected && isAuthenticated && !authService.hasStoredToken()) {
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
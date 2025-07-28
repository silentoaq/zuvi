import { useWallet } from '@solana/wallet-adapter-react'
import { useAuth } from '@/hooks/use-auth'
import { ApiService } from '@/services/api'
import { useState } from 'react'
import bs58 from 'bs58'

export function useWalletAuth() {
  const { publicKey, signMessage, connected, connect, disconnect } = useWallet()
  const { setAuth, logout } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    try {
      setIsLoading(true)
      setError(null)

      if (!connected) {
        await connect()
        return
      }

      if (!publicKey || !signMessage) {
        throw new Error('錢包未正確連接')
      }

      // 生成登入訊息
      const { message } = await ApiService.generateLoginMessage(publicKey.toBase58())
      
      // 簽名訊息
      const messageBytes = new TextEncoder().encode(message)
      const signatureBytes = await signMessage(messageBytes)
      const signature = bs58.encode(signatureBytes)

      // 使用錢包地址作為 DID (基於你的設計)
      const did = `did:solana:${publicKey.toBase58()}`

      // 登入
      const loginResponse = await ApiService.login(
        publicKey.toBase58(),
        did,
        signature,
        message
      )

      if (loginResponse.success) {
        setAuth(loginResponse.user, loginResponse.token)
      } else {
        throw new Error('登入失敗')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '連接失敗')
      console.error('Wallet connection error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      logout()
    } catch (err) {
      console.error('Disconnect error:', err)
    }
  }

  return {
    connected,
    publicKey,
    isLoading,
    error,
    connect: handleConnect,
    disconnect: handleDisconnect,
  }
}
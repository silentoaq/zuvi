import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAuthStore } from '@/stores/authStore'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface ProtectedRouteProps {
  children: ReactNode
  requireWallet?: boolean
  requireCitizen?: boolean
  requireProperty?: boolean
  requireArbitrator?: boolean
}

export default function ProtectedRoute({
  children,
  requireWallet = false,
  requireCitizen = false,
  requireProperty = false,
  requireArbitrator = false
}: ProtectedRouteProps) {
  const { connected } = useWallet()
  const { user, isAuthenticated } = useAuthStore()
  const location = useLocation()

  if (requireWallet && !connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Alert className="max-w-md">
          <AlertDescription>
            請先連接錢包以訪問此功能
          </AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()}>
          重新整理頁面
        </Button>
      </div>
    )
  }

  if (connected && !isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Alert className="max-w-md">
          <AlertDescription>
            正在驗證您的身份，請稍候...
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (requireCitizen && (!user?.credentialStatus?.twfido?.exists)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Alert className="max-w-md">
          <AlertDescription>
            此功能需要自然人憑證驗證
          </AlertDescription>
        </Alert>
        <Button asChild>
          <a href="https://twfido.ddns.net" target="_blank" rel="noopener noreferrer">
            前往申請自然人憑證
          </a>
        </Button>
      </div>
    )
  }

  if (requireProperty && (!user?.credentialStatus?.twland?.exists)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Alert className="max-w-md">
          <AlertDescription>
            此功能需要產權憑證驗證
          </AlertDescription>
        </Alert>
        <Button asChild>
          <a href="https://twland.ddns.net" target="_blank" rel="noopener noreferrer">
            前往申請產權憑證
          </a>
        </Button>
      </div>
    )
  }

  if (requireArbitrator && !user?.isArbitrator) {
    return <Navigate to="/" state={{ from: location }} replace />
  }

  return <>{children}</>
}
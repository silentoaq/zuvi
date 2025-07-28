import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useWalletAuth } from "@/hooks/use-wallet-auth"
import { useAuth } from "@/hooks/use-auth"
import { Navigate } from "react-router-dom"
import { Loader2 } from "lucide-react"

export function LoginPage() {
  const { isAuthenticated } = useAuth()
  const { connect, isLoading, error } = useWalletAuth()

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>登入 Zuvi</CardTitle>
          <CardDescription>
            連接您的 Solana 錢包以開始使用
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            className="w-full" 
            onClick={connect}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            連接 Phantom 錢包
          </Button>
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
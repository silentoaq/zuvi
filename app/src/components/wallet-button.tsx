import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useWalletAuth } from "@/hooks/use-wallet-auth"
import { Wallet, LogOut, Loader2 } from "lucide-react"

export function WalletButton() {
  const { user, isAuthenticated } = useAuth()
  const { connect, disconnect, isLoading } = useWalletAuth()

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {user.publicKey.slice(0, 4)}...{user.publicKey.slice(-4)}
        </span>
        <Button variant="outline" size="sm" onClick={disconnect}>
          <LogOut className="h-4 w-4 mr-2" />
          登出
        </Button>
      </div>
    )
  }

  return (
    <Button variant="outline" size="sm" onClick={connect} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Wallet className="h-4 w-4 mr-2" />
      )}
      連接錢包
    </Button>
  )
}
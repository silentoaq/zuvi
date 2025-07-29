import { Link, useLocation } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useTheme } from 'next-themes'
import { Home, Building, FileText, Gavel, Wallet, Moon, Sun, LogOut, User, Loader2, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { 
  NavigationMenu, 
  NavigationMenuContent, 
  NavigationMenuItem, 
  NavigationMenuLink, 
  NavigationMenuList, 
  NavigationMenuTrigger 
} from '@/components/ui/navigation-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { authService } from '@/service/auth'

export default function Navbar() {
  const { connected, publicKey, disconnect } = useWallet()
  const { setVisible } = useWalletModal()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const { isAuthenticated, user } = useAuthStore()

  const isActive = (path: string) => location.pathname === path

  const handleWalletClick = () => {
    if (!connected) {
      setVisible(true)
    }
  }

  const handleDisconnect = () => {
    disconnect()
    authService.logout()
  }

  const refreshCredentials = async () => {
    if (!isAuthenticated) return
    
    try {
      await authService.refreshCredentials()
    } catch (error) {
      console.error('刷新憑證失敗:', error)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const AttestationStatus = ({ className }: { className?: string }) => {
    if (!isAuthenticated) {
      return (
        <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted", className)}>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">認證中</span>
        </div>
      );
    }

    const hasCitizen = user?.credentialStatus?.twfido?.exists
    const hasProperty = user?.credentialStatus?.twland?.exists
    const propertyCount = user?.credentialStatus?.twland?.count || 0

    return (
      <div className={cn("group relative flex items-center gap-1 px-2.5 py-1.5 bg-muted rounded-lg cursor-help", className)}>
        <User className={cn(
          "h-4 w-4",
          hasCitizen ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
        )} />
        <Building className={cn(
          "h-4 w-4",
          hasProperty ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
        )} />
        <span className={cn(
          "text-sm font-medium",
          hasProperty ? 
            "text-green-600 dark:text-green-400" : 
            hasCitizen ? 
              "text-blue-600 dark:text-blue-400" : 
              "text-muted-foreground"
        )}>
          {propertyCount}
        </span>
        
        <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute top-full mt-2 right-0 z-50 w-48 p-2 text-xs bg-popover border rounded-md shadow-md transition-all">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <User className="h-3 w-3" />
              <span>{hasCitizen ? "已驗證" : "未驗證"}自然人憑證</span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="h-3 w-3" />
              <span>{propertyCount} 個房產憑證</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center space-x-8">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">Zuvi</span>
          </Link>

          <NavigationMenu viewport={false}>
            <NavigationMenuList>
              <NavigationMenuItem>
                <Link to="/" className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors hover:text-foreground/80",
                  isActive('/') ? "text-foreground" : "text-foreground/60"
                )}>
                  <Home className="inline h-4 w-4 mr-2" />
                  房源
                </Link>
              </NavigationMenuItem>

              {connected && (
                <>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>
                      <FileText className="h-4 w-4 mr-2" />
                      申請管理
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid w-[200px] gap-4">
                        <li>
                          <NavigationMenuLink asChild>
                            <Link to="/applications">
                              我的申請
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>

                  {user?.credentialStatus?.twland?.exists && (
                    <NavigationMenuItem>
                      <NavigationMenuTrigger>
                        <Building className="h-4 w-4 mr-2" />
                        房東管理
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ul className="grid w-[200px] gap-4">
                          <li>
                            <NavigationMenuLink asChild>
                              <Link to="/listings/create">
                                刊登房源
                              </Link>
                            </NavigationMenuLink>
                            <NavigationMenuLink asChild>
                              <Link to="/listings/manage">
                                管理房源
                              </Link>
                            </NavigationMenuLink>
                            <NavigationMenuLink asChild>
                              <Link to="/leases/manage">
                                租約管理
                              </Link>
                            </NavigationMenuLink>
                          </li>
                        </ul>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  )}

                  {user?.isArbitrator && (
                    <NavigationMenuItem>
                      <Link to="/disputes" className={cn(
                        "px-3 py-2 text-sm font-medium transition-colors hover:text-foreground/80",
                        isActive('/disputes') ? "text-foreground" : "text-foreground/60"
                      )}>
                        <Gavel className="inline h-4 w-4 mr-2" />
                        爭議處理
                      </Link>
                    </NavigationMenuItem>
                  )}
                </>
              )}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="flex items-center space-x-4">
          {connected && (
            <AttestationStatus />
          )}

          {user?.isArbitrator && (
            <Badge variant="default">仲裁者</Badge>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          {connected ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center space-x-2">
                  <Wallet className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {publicKey ? formatAddress(publicKey.toString()) : 'Connected'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={refreshCredentials}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  刷新憑證
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDisconnect}>
                  <LogOut className="h-4 w-4 mr-2" />
                  中斷連接
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={handleWalletClick} className="flex items-center space-x-2">
              <Wallet className="h-4 w-4" />
              <span>連接錢包</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
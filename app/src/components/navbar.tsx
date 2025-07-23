import { Link, useLocation } from "react-router-dom";
import { Bell, User, Building, Loader2, Copy, LogOut, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWallet } from "@/hooks/use-wallet";
import { useAttestation } from "@/hooks/use-attestation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function Navbar() {
  const location = useLocation();
  const { wallet, connect, disconnect, shortAddress } = useWallet();
  const { attestation, loading } = useAttestation(wallet?.publicKey?.toString());

  const navItems = [
    { path: "/", label: "瀏覽房源" },
    { path: "/list-property", label: "發布房源", protected: true, requireProperty: true },
    { path: "/my-properties", label: "我的房源", protected: true },
    { path: "/my-contracts", label: "我的合約", protected: true },
  ];

  const visibleNavItems = navItems.filter(item => {
    if (!item.protected) return true;
    if (!wallet) return false;
    if (item.requireProperty && !attestation?.hasProperty) return false;
    return true;
  });

  const copyAddress = async () => {
    if (wallet?.publicKey) {
      try {
        await navigator.clipboard.writeText(wallet.publicKey.toString());
        toast.success("已複製錢包地址");
      } catch (error) {
        toast.error("複製失敗，請重試");
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link to="/" className="mr-6 flex items-center space-x-2">
          <span className="font-bold text-lg">zuvi</span>
        </Link>

        <NavigationMenu className="mr-auto">
          <NavigationMenuList>
            {visibleNavItems.map((item) => (
              <NavigationMenuItem key={item.path}>
                <Link to={item.path}>
                  <NavigationMenuLink
                    className={cn(
                      navigationMenuTriggerStyle(),
                      location.pathname === item.path && "bg-accent"
                    )}
                  >
                    {item.label}
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
          </Button>

          <ModeToggle />

          {wallet ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-mono gap-2"
                  >
                    <Wallet className="h-4 w-4" />
                    {shortAddress}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <div className="p-2">
                    <p className="text-sm font-medium mb-1">錢包地址</p>
                    <div className="flex items-center gap-2 p-2 rounded bg-muted">
                      <p className="font-mono text-xs break-all flex-1">
                        {wallet.publicKey.toString()}
                      </p>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await copyAddress();
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => {
                      disconnect();
                      toast.success("已登出錢包");
                    }}
                    className="text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    登出錢包
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {loading ? (
                <div className="px-2.5 py-1 rounded-full flex items-center gap-1.5 bg-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">查詢中</span>
                </div>
              ) : (
                <div className={cn(
                  "px-2.5 py-1 rounded-full flex items-center gap-1.5",
                  attestation?.hasCitizen && attestation?.hasProperty 
                    ? "bg-green-500/20" 
                    : attestation?.hasCitizen 
                    ? "bg-yellow-500/20" 
                    : "bg-muted"
                )}>
                  <User className={cn(
                    "h-4 w-4",
                    attestation?.hasCitizen 
                      ? attestation?.hasProperty ? "text-green-500" : "text-yellow-500"
                      : "text-muted-foreground"
                  )} />
                  <span className="text-xs text-muted-foreground">/</span>
                  <Building className={cn(
                    "h-4 w-4",
                    attestation?.hasProperty ? "text-green-500" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-xs font-medium",
                    attestation?.hasProperty ? "text-green-500" : "text-muted-foreground"
                  )}>
                    {attestation?.propertyCount || 0}
                  </span>
                </div>
              )}
            </>
          ) : (
            <Button 
              onClick={async () => {
                const success = await connect();
                if (success) {
                  toast.success("錢包連接成功");
                }
              }} 
              size="sm"
            >
              連接錢包
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
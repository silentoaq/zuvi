import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, User, Building, Loader2, Copy, LogOut, Wallet, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useWallet } from "@/hooks/use-wallet";
import { useAttestation } from "@/hooks/use-attestation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { wallet, connect, disconnect, shortAddress } = useWallet();
  const { attestation, loading } = useAttestation();
  const [sheetOpen, setSheetOpen] = useState(false);
  
  // 模擬通知數量（實際應從 API 或 state 獲取）
  const notificationCount = 3;

  const navItems = [
    { path: "/", label: "房源市場" },
    { path: "/dashboard", label: "管理中心" },
  ];

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

  const AttestationStatus = ({ className }: { className?: string }) => {
    if (loading) {
      return (
        <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted", className)}>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">查詢中</span>
        </div>
      );
    }

    return (
      <div className={cn("group relative flex items-center gap-1 px-2.5 py-1.5 bg-muted rounded-lg cursor-help", className)}>
        <User className={cn(
          "h-4 w-4",
          attestation?.hasCitizen ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
        )} />
        <Building className={cn(
          "h-4 w-4",
          attestation?.hasProperty ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
        )} />
        <span className={cn(
          "text-sm font-medium",
          attestation?.hasProperty ? 
            "text-green-600 dark:text-green-400" : 
            attestation?.hasCitizen ? 
              "text-blue-600 dark:text-blue-400" : 
              "text-muted-foreground"
        )}>
          {attestation?.propertyCount || 0}
        </span>
        
        <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute top-full mt-2 right-0 z-50 w-48 p-2 text-xs bg-popover border rounded-md shadow-md transition-all">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <User className="h-3 w-3" />
              <span>{attestation?.hasCitizen ? "已驗證" : "未驗證"}自然人憑證</span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="h-3 w-3" />
              <span>{attestation?.propertyCount || 0} 個房產憑證</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const WalletMenu = () => {
    if (!wallet) {
      return (
        <Button 
          onClick={connect} 
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Wallet className="h-4 w-4" />
          連接錢包
        </Button>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className="gap-2"
          >
            <Wallet className="h-4 w-4" />
            {shortAddress}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="p-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">錢包地址</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
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
    );
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center">
          <Link to="/" className="flex items-center">
            <span className="font-bold text-lg">zuvi</span>
          </Link>

          {/* Desktop Navigation */}
          <NavigationMenu className="ml-8 hidden md:flex">
            <NavigationMenuList>
              {navItems.map((item) => (
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

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            {/* 發布房源按鈕 - 只在房源市場頁顯示 */}
            {location.pathname === "/" && attestation?.hasProperty && (
              <Button 
                onClick={() => navigate("/publish")}
                size="sm"
                className="hidden md:inline-flex"
              >
                發布房源
              </Button>
            )}
            
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <Badge 
                  className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 text-[10px] font-medium"
                >
                  {notificationCount > 9 ? "9+" : notificationCount}
                </Badge>
              )}
            </Button>
            <ModeToggle />
            <WalletMenu />
            {wallet && <AttestationStatus className="hidden md:flex" />}
          </div>

          {/* Mobile menu */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild className="md:hidden ml-2">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <nav className="flex flex-col gap-4 mt-8">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSheetOpen(false)}
                    className={cn(
                      "text-lg font-medium transition-colors hover:text-primary",
                      location.pathname === item.path 
                        ? "text-primary" 
                        : "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
                {location.pathname === "/" && attestation?.hasProperty && (
                  <Button 
                    onClick={() => {
                      navigate("/publish");
                      setSheetOpen(false);
                    }}
                    className="w-full"
                  >
                    發布房源
                  </Button>
                )}
                {wallet && (
                  <div className="pt-4 border-t">
                    <AttestationStatus />
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
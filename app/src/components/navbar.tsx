import { Link, useLocation } from "react-router-dom";
import { Bell, User, Building, Loader2, Copy, LogOut, Wallet, Menu } from "lucide-react";
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
  const { wallet, connect, disconnect, shortAddress } = useWallet();
  const { attestation, loading } = useAttestation();
  const [sheetOpen, setSheetOpen] = useState(false);

  const navItems = [
    { path: "/", label: "瀏覽房源" },
    { path: "/list-property", label: "發布房源" },
    { path: "/my-properties", label: "我的房源" },
    { path: "/my-contracts", label: "我的合約" },
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
          attestation?.hasCitizen ? "text-blue-600 dark:textblue-400" : "text-muted-foreground"
        )} />
        <Building className={cn(
          "h-4 w-4",
          attestation?.hasProperty ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
        )} />
        <span className={cn(
          "text-sm font-medium",
          attestation?.hasProperty ? "text-foreground" : "text-muted-foreground"
        )}>
          {attestation?.propertyCount || 0}
        </span>

        {/* Desktop Tooltip */}
        <div className="hidden md:block absolute top-full mt-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          <div className="bg-popover text-popover-foreground border text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-md">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3" />
                <span>{attestation?.hasCitizen ? "自然人憑證已驗證" : "自然人憑證未驗證"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building className="h-3 w-3" />
                <span>
                  {attestation?.hasProperty 
                    ? `擁有 ${attestation.propertyCount} 個房產憑證`
                    : "房產憑證未驗證"}
                </span>
              </div>
            </div>
            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-popover border-l border-t rotate-45"></div>
          </div>
        </div>
      </div>
    );
  };

  const WalletButton = () => {
    if (!wallet) {
      return (
        <Button 
          onClick={async () => {
            const success = await connect();
            if (success) {
              toast.success("錢包連接成功");
            }
          }} 
          size="sm"
          className="h-9"
        >
          <Wallet className="mr-2 h-4 w-4 md:hidden" />
          <span className="hidden md:inline">連接錢包</span>
          <span className="md:hidden">連接</span>
        </Button>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-2 sm:px-3 font-mono"
          >
            <Wallet className="mr-1 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">{shortAddress}</span>
            <span className="sm:hidden">{shortAddress?.slice(0, 4)}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 sm:w-80">
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
            {/* 通知按鈕 - 所有尺寸都顯示 */}
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
            </Button>

            {/* 主題切換 - 桌面版顯示 */}
            <div className="hidden md:block">
              <ModeToggle />
            </div>

            {/* 錢包按鈕 */}
            <WalletButton />

            {/* 憑證狀態 - 桌面版顯示 */}
            {wallet && (
              <div className="hidden md:block">
                <AttestationStatus />
              </div>
            )}

            {/* Mobile menu */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-9 w-9"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] sm:w-[385px] p-0">
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="p-6 pb-4 border-b">
                    <h2 className="text-lg font-semibold">選單</h2>
                    
                    {/* Mobile attestation status */}
                    {wallet && (
                      <div className="mt-4">
                        {/* 手機版憑證說明 */}
                        <div className="mt-2 text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            <span>{attestation?.hasCitizen ? "自然人憑證已驗證" : "自然人憑證未驗證"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Building className="h-3 w-3" />
                            <span>
                              {attestation?.hasProperty 
                                ? `擁有 ${attestation?.propertyCount || 0} 個房產憑證`
                                : "房產憑證未驗證"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Navigation */}
                  <nav className="flex-1 p-4">
                    <div className="space-y-1">
                      {navItems.map((item) => (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setSheetOpen(false)}
                          className={cn(
                            "block px-4 py-3 rounded-lg text-base font-medium transition-colors",
                            location.pathname === item.path
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-accent/50"
                          )}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </nav>

                  {/* Bottom section */}
                  <div className="p-4 border-t bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">深色模式</span>
                      <ModeToggle />
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
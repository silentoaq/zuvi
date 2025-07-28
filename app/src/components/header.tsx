import { ThemeToggle } from "@/components/theme-toggle"
import { WalletButton } from "@/components/wallet-button"

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between px-6 border-b bg-background">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">儀表板</h2>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <WalletButton />
      </div>
    </header>
  )
}
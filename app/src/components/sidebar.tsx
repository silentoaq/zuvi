import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import {
  Home,
  Search,
  FileText,
  HandHeart,
  Building,
  Users,
  Receipt,
  DollarSign,
  AlertTriangle,
} from "lucide-react"

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  requireCitizen?: boolean
  requireProperty?: boolean
}

const navItems: NavItem[] = [
  {
    title: "總覽",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "房源瀏覽",
    href: "/dashboard/browse",
    icon: Search,
    requireCitizen: true,
  },
  {
    title: "我的申請",
    href: "/dashboard/applications",
    icon: FileText,
    requireCitizen: true,
  },
  {
    title: "我的租約",
    href: "/dashboard/leases/tenant",
    icon: HandHeart,
    requireCitizen: true,
  },
  {
    title: "我的房源",
    href: "/dashboard/listings",
    icon: Building,
    requireProperty: true,
  },
  {
    title: "申請管理",
    href: "/dashboard/applications/manage",
    icon: Users,
    requireProperty: true,
  },
  {
    title: "房東租約",
    href: "/dashboard/leases/landlord",
    icon: Receipt,
    requireProperty: true,
  },
  {
    title: "收支記錄",
    href: "/dashboard/payments",
    icon: DollarSign,
  },
  {
    title: "爭議處理",
    href: "/dashboard/disputes",
    icon: AlertTriangle,
  },
]

export function Sidebar() {
  const location = useLocation()
  const { user } = useAuth()

  if (!user) return null

  const filteredNavItems = navItems.filter((item) => {
    if (item.requireCitizen && !user.credentials.hasCitizenCredential) {
      return false
    }
    if (item.requireProperty && !user.credentials.hasPropertyCredential) {
      return false
    }
    return true
  })

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r">
      <div className="flex h-16 items-center px-6 border-b">
        <h1 className="text-xl font-bold">Zuvi</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {filteredNavItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                location.pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
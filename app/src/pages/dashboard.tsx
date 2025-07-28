import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"

export function DashboardPage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">儀表板</h1>
        <p className="text-muted-foreground">歡迎回到 Zuvi 租房平台</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>我的憑證</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">自然人憑證</span>
              <Badge variant={user.credentials.hasCitizenCredential ? "default" : "secondary"}>
                {user.credentials.hasCitizenCredential ? "已驗證" : "未驗證"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">產權憑證</span>
              <Badge variant={user.credentials.hasPropertyCredential ? "default" : "secondary"}>
                {user.credentials.hasPropertyCredential ? `${user.credentials.propertyCount} 筆` : "未驗證"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>錢包資訊</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono">
              {user.publicKey.slice(0, 8)}...{user.publicKey.slice(-8)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
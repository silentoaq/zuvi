import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export function CredentialsRequiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-[500px]">
        <CardHeader className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <CardTitle>需要憑證驗證</CardTitle>
          <CardDescription>
            您需要擁有相應的憑證才能使用此功能
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm">
              <p className="font-medium mb-2">可用功能：</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>自然人憑證：可申請租房</li>
                <li>產權憑證：可出租房源</li>
              </ul>
            </div>
            <Button className="w-full">
              前往憑證申請
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
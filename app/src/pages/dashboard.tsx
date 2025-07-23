import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building, Home, FileText, CreditCard, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAttestation } from "@/hooks/use-attestation";
import { cn } from "@/lib/utils";

interface PropertyCredential {
  address: string;
  merkleRoot: string;
  credentialId: string;
  expiry: number;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { attestation } = useAttestation();
  const [selectedTab, setSelectedTab] = useState("applications");

  // 產權憑證卡片
  const PropertyCredentialCard = ({ credential }: { credential: PropertyCredential }) => {
    return (
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <Building className="h-8 w-8 text-green-600 dark:text-green-400" />
            <Badge variant="outline" className="text-xs">
              有效至 {new Date(credential.expiry * 1000).toLocaleDateString()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">憑證地址</p>
            <p className="text-sm font-mono truncate">{credential.address}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Merkle Root</p>
            <p className="text-sm font-mono truncate">{credential.merkleRoot}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">憑證參考</p>
            <p className="text-sm font-mono truncate">{credential.credentialId}</p>
          </div>
          <Button 
            className="w-full mt-4" 
            onClick={() => {
              // TODO: 這裡要整合揭露流程
              navigate("/publish", { 
                state: { 
                  credentialId: credential.credentialId,
                  address: credential.address 
                } 
              });
            }}
          >
            發布房源
          </Button>
        </CardContent>
      </Card>
    );
  };

  // 申請管理內容
  const ApplicationsContent = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>租房申請</CardTitle>
          <CardDescription>管理您提交的租房申請</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">暫無申請記錄</p>
        </CardContent>
      </Card>
    </div>
  );

  // 房源管理內容
  const PropertiesContent = () => {
    if (!attestation?.hasProperty) {
      return (
        <Card>
          <CardContent className="text-center py-12">
            <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">您尚未擁有房產憑證</p>
            <p className="text-sm text-muted-foreground mt-2">請先至 walletbz 申請房產憑證</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {/* 房產憑證區塊 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">我的房產憑證</h3>
            <Badge>{attestation.propertyCount} 個房產</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attestation.attestations?.twland?.list.map((credential: PropertyCredential, index: number) => (
              <PropertyCredentialCard key={index} credential={credential} />
            ))}
          </div>
        </div>

        {/* 已發布房源 */}
        <div>
          <h3 className="text-lg font-semibold mb-4">已發布房源</h3>
          <Card>
            <CardContent className="text-center py-8">
              <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">尚未發布任何房源</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate("/")}
              >
                <Plus className="h-4 w-4 mr-2" />
                查看範例
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // 合約管理內容
  const ContractsContent = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>租賃合約</CardTitle>
          <CardDescription>管理所有相關的租賃合約</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">暫無合約記錄</p>
        </CardContent>
      </Card>
    </div>
  );

  // 付款記錄內容
  const PaymentsContent = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>付款記錄</CardTitle>
          <CardDescription>查看所有收付款歷史</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">暫無付款記錄</p>
        </CardContent>
      </Card>
    </div>
  );

  const tabs = [
    { value: "applications", label: "申請管理", icon: FileText },
    { value: "properties", label: "房源管理", icon: Building, requireProperty: true },
    { value: "contracts", label: "合約管理", icon: FileText },
    { value: "payments", label: "付款記錄", icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">管理中心</h1>
        <p className="text-muted-foreground mt-2">
          管理您的房源、申請、合約與付款記錄
        </p>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid grid-cols-4 h-auto p-1">
          {tabs.map((tab) => {
            const show = !tab.requireProperty || attestation?.hasProperty;
            const Icon = tab.icon;
            
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                disabled={!show}
                className={cn(
                  "flex flex-col gap-1 py-2",
                  !show && "opacity-50"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="applications" className="mt-4">
          <ApplicationsContent />
        </TabsContent>
        
        <TabsContent value="properties" className="mt-4">
          <PropertiesContent />
        </TabsContent>
        
        <TabsContent value="contracts" className="mt-4">
          <ContractsContent />
        </TabsContent>
        
        <TabsContent value="payments" className="mt-4">
          <PaymentsContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
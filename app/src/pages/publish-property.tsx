import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAttestation } from "@/hooks/use-attestation";

export function PublishPropertyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { attestation } = useAttestation();
  
  // 從導航 state 獲取憑證資訊（如果有）
  const stateCredentialId = location.state?.credentialId;
  
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>(stateCredentialId || "");
  const [loading, setLoading] = useState(false);
  const [disclosureStep, setDisclosureStep] = useState<"pending" | "verifying" | "completed" | null>(null);

  // 如果沒有預選憑證，且只有一個憑證，自動選擇
  useEffect(() => {
    if (!stateCredentialId && attestation?.attestations?.twland?.list.length === 1) {
      setSelectedCredentialId(attestation.attestations.twland.list[0].credentialId);
    }
  }, [stateCredentialId, attestation]);
  
  // 表單狀態
  const [formData, setFormData] = useState({
    monthlyRent: "",
    depositMonths: "2",
    description: "",
    // 這些欄位需要從憑證揭露獲取
    propertyAddress: "",
    buildingArea: "",
    propertyUse: "",
  });

  // 揭露的資料
  const [disclosedData, setDisclosedData] = useState<{
    address?: string;
    building_area?: string;
    use?: string;
  } | null>(null);

  // 開始憑證揭露流程
  const startDisclosure = async () => {
    if (!selectedCredentialId) {
      toast.error("請先選擇房產憑證");
      return;
    }

    setLoading(true);
    setDisclosureStep("pending");

    try {
      // TODO: 呼叫後端 API 建立揭露請求
      const response = await fetch("/api/disclosure/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // TODO: 添加認證 header
        },
        body: JSON.stringify({
          credentialId: selectedCredentialId,
          requiredFields: ["address", "building_area", "use"],
          purpose: "發布房源於 zuvi 平台",
        }),
      });

      if (!response.ok) {
        throw new Error("建立揭露請求失敗");
      }

      const { requestId, vpRequestUri } = await response.json();

      // TODO: 顯示 QR Code 或深層連結讓用戶在 walletbz 完成揭露
      setDisclosureStep("verifying");

      // TODO: 輪詢檢查揭露狀態
      // 這裡需要實作輪詢邏輯
      
      // 模擬揭露完成（實際應該從 API 獲取）
      setTimeout(() => {
        setDisclosedData({
          address: "台北市信義區信義路五段7號",
          building_area: "35.5",
          use: "住宅"
        });
        setDisclosureStep("completed");
      }, 3000);

    } catch (error) {
      console.error("Disclosure error:", error);
      toast.error("無法完成憑證揭露，請稍後再試");
      setDisclosureStep(null);
    } finally {
      setLoading(false);
    }
  };

  // 提交發布房源
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!disclosedData) {
      toast.error("請先完成憑證揭露");
      return;
    }

    setLoading(true);

    try {
      // TODO: 呼叫後端 API 發布房源
      // 這會觸發 Solana 交易

      toast.success("房源已成功發布");
      navigate("/dashboard");
    } catch (error) {
      console.error("Publish error:", error);
      toast.error("無法發布房源，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  // 如果沒有房產憑證，顯示提示
  if (!attestation?.hasProperty || !attestation?.attestations?.twland) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="text-center py-12">
            <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">需要房產憑證</p>
            <p className="text-muted-foreground mb-4">
              您需要先至 walletbz 申請房產憑證才能發布房源
            </p>
            <Button variant="outline" onClick={() => navigate(-1)}>
              返回
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">發布房源</h1>
          <p className="text-muted-foreground">填寫房源資訊並完成憑證驗證</p>
        </div>
      </div>

      {/* 憑證揭露卡片 */}
      {!disclosedData && (
        <Card>
          <CardHeader>
            <CardTitle>步驟 1：憑證揭露</CardTitle>
            <CardDescription>
              需要揭露房產憑證中的地址、建築面積和使用類型
            </CardDescription>
          </CardHeader>
          <CardContent>
            {disclosureStep === null && (
              <div className="space-y-4">
                {/* 憑證選擇器 - 只在沒有預選時顯示 */}
                {!stateCredentialId && attestation?.attestations?.twland && (
                  <div className="space-y-2">
                    <Label htmlFor="credential-select">選擇房產憑證</Label>
                    <Select 
                      value={selectedCredentialId} 
                      onValueChange={setSelectedCredentialId}
                    >
                      <SelectTrigger id="credential-select">
                        <SelectValue placeholder="請選擇要使用的房產憑證" />
                      </SelectTrigger>
                      <SelectContent>
                        {attestation.attestations.twland.list.map((credential, index) => (
                          <SelectItem 
                            key={index} 
                            value={credential.credentialId}
                          >
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4" />
                              <span className="font-mono text-sm">
                                {credential.credentialId.slice(0, 16)}...
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {/* 顯示選中的憑證 */}
                {selectedCredentialId && (
                  <div className="text-sm space-y-2">
                    <p>選擇的憑證：</p>
                    <code className="block p-2 bg-muted rounded text-xs">
                      {selectedCredentialId}
                    </code>
                  </div>
                )}
                
                <Button 
                  onClick={startDisclosure}
                  disabled={!selectedCredentialId || loading}
                  className="w-full"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  開始憑證揭露
                </Button>
              </div>
            )}

            {disclosureStep === "pending" && (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>正在建立揭露請求...</p>
              </div>
            )}

            {disclosureStep === "verifying" && (
              <div className="text-center py-8">
                <div className="w-48 h-48 bg-muted mx-auto mb-4 rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">QR Code</p>
                </div>
                <p className="mb-2">請使用 walletbz 掃描 QR Code</p>
                <p className="text-sm text-muted-foreground">等待憑證揭露完成...</p>
              </div>
            )}

            {disclosureStep === "completed" && disclosedData && (
              <div className="space-y-3">
                <p className="text-green-600 dark:text-green-400 font-medium">
                  ✓ 憑證揭露完成
                </p>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">地址：</span>
                    <span className="ml-2">{disclosedData.address}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">建築面積：</span>
                    <span className="ml-2">{disclosedData.building_area} 坪</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">使用類型：</span>
                    <span className="ml-2">{disclosedData.use}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 房源資訊表單 */}
      <Card className={cn(
        !disclosedData && "opacity-50 pointer-events-none"
      )}>
        <CardHeader>
          <CardTitle>步驟 2：房源資訊</CardTitle>
          <CardDescription>
            填寫租金、押金等詳細資訊
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyRent">月租金 (USDC)</Label>
                <Input
                  id="monthlyRent"
                  type="number"
                  placeholder="例：500"
                  value={formData.monthlyRent}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    monthlyRent: e.target.value
                  }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="depositMonths">押金（月數）</Label>
                <Input
                  id="depositMonths"
                  type="number"
                  min="1"
                  max="3"
                  value={formData.depositMonths}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    depositMonths: e.target.value
                  }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">房源描述</Label>
              <Textarea
                id="description"
                placeholder="描述房源特色、設備、交通等資訊..."
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  description: e.target.value
                }))}
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={loading || !disclosedData}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              發布房源
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
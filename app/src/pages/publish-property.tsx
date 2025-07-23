import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Building, QrCode, RefreshCw } from "lucide-react";
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
import { useWallet } from "@/hooks/use-wallet";

interface DisclosedData {
  address: string;
  building_area: string;
  use: string;
}

export function PublishPropertyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { attestation } = useAttestation();
  const { wallet } = useWallet();
  
  const stateCredentialId = location.state?.credentialId;
  
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>(stateCredentialId || "");
  const [loading, setLoading] = useState(false);
  const [disclosureStep, setDisclosureStep] = useState<"pending" | "verifying" | "completed" | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [vpRequestUri, setVpRequestUri] = useState<string | null>(null);

  useEffect(() => {
    if (!stateCredentialId && attestation?.attestations?.twland?.list.length === 1) {
      setSelectedCredentialId(attestation.attestations.twland.list[0].credentialId);
    }
  }, [stateCredentialId, attestation]);
  
  const [formData, setFormData] = useState({
    monthlyRent: "",
    depositMonths: "2",
    description: "",
    propertyAddress: "",
    buildingArea: "",
    propertyUse: "",
  });

  const [disclosedData, setDisclosedData] = useState<DisclosedData | null>(null);
  // TODO: 第二批實作圖片上傳
  // const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  // 創建簽名訊息
  const createAuthToken = async () => {
    if (!wallet) throw new Error("Wallet not connected");
    
    const message = `Authenticate for zuvi: ${Date.now()}`;
    const encodedMessage = new TextEncoder().encode(message);
    const { signature } = await wallet.signMessage(encodedMessage);
    
    const signatureBase64 = btoa(String.fromCharCode(...signature));
    return `${wallet.publicKey.toString()}.${signatureBase64}.${btoa(message)}`;
  };

  // 開始揭露流程
  const handleStartDisclosure = async () => {
    if (!selectedCredentialId) {
      toast.error("請選擇一個產權憑證");
      return;
    }

    try {
      setLoading(true);
      setDisclosureStep("verifying");
      
      const token = await createAuthToken();
      
      // 創建揭露請求
      const response = await fetch("/api/disclosure/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ credentialId: selectedCredentialId })
      });

      if (!response.ok) {
        throw new Error("Failed to create disclosure request");
      }

      const data = await response.json();
      setQrCodeUrl(data.qrCodeUrl);
      setVpRequestUri(data.vpRequestUri);
      
      // 開始輪詢狀態
      pollDisclosureStatus(data.requestId, token);
    } catch (error) {
      console.error("Disclosure error:", error);
      toast.error("揭露請求失敗");
      setDisclosureStep(null);
    } finally {
      setLoading(false);
    }
  };

  // 輪詢揭露狀態
  const pollDisclosureStatus = async (reqId: string, token: string) => {
    let attempts = 0;
    const maxAttempts = 150; // 5 分鐘

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/disclosure/status/${reqId}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error("Failed to get status");
        }

        const status = await response.json();
        
        if (status.status === "completed" && status.disclosedData) {
          setDisclosedData(status.disclosedData);
          setFormData(prev => ({
            ...prev,
            propertyAddress: status.disclosedData.address,
            buildingArea: status.disclosedData.building_area,
            propertyUse: status.disclosedData.use
          }));
          setDisclosureStep("completed");
          toast.success("憑證揭露成功");
          return;
        }
        
        if (status.status === "expired") {
          throw new Error("Disclosure request expired");
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 2000);
        } else {
          throw new Error("Disclosure timeout");
        }
      } catch (error) {
        console.error("Status check error:", error);
        toast.error("揭露請求逾時或失敗");
        setDisclosureStep(null);
      }
    };

    checkStatus();
  };

  // 處理表單提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!disclosedData) {
      toast.error("請先完成憑證揭露");
      return;
    }

    // TODO: 第二批實作圖片上傳檢查
    // if (uploadedImages.length === 0) {
    //   toast.error("請至少上傳一張房源照片");
    //   return;
    // }

    // TODO: 實作發布房源到鏈上
    toast.info("發布功能即將完成");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">發布房源</h1>
      </div>

      {/* 步驟 1：選擇憑證並揭露 */}
      <Card>
        <CardHeader>
          <CardTitle>步驟 1：選擇產權憑證</CardTitle>
          <CardDescription>
            選擇要發布的房產憑證，並揭露必要資訊
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {attestation?.attestations?.twland?.list && attestation.attestations.twland.list.length > 0 ? (
            <>
              <div className="space-y-2">
                <Label>選擇憑證</Label>
                <Select
                  value={selectedCredentialId}
                  onValueChange={setSelectedCredentialId}
                  disabled={disclosureStep !== null}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇一個產權憑證" />
                  </SelectTrigger>
                  <SelectContent>
                    {attestation.attestations.twland.list.map((cred) => (
                      <SelectItem key={cred.credentialId} value={cred.credentialId}>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          <span className="font-mono text-sm">{cred.credentialId}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!disclosureStep && (
                <Button 
                  onClick={handleStartDisclosure}
                  disabled={!selectedCredentialId || loading}
                  className="w-full"
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <QrCode className="mr-2 h-4 w-4" />
                  )}
                  開始憑證揭露
                </Button>
              )}

              {disclosureStep === "verifying" && (
                <div className="text-center py-8 space-y-4">
                  {qrCodeUrl && (
                    <img 
                      src={qrCodeUrl} 
                      alt="Disclosure QR Code"
                      className="w-48 h-48 mx-auto"
                    />
                  )}
                  <div className="space-y-2">
                    <p className="font-medium">請使用 walletbz 掃描 QR Code</p>
                    <p className="text-sm text-muted-foreground">或複製連結到 walletbz</p>
                    {vpRequestUri && (
                      <div className="flex items-center justify-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded max-w-xs truncate">
                          {vpRequestUri}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(vpRequestUri);
                            toast.success("已複製連結");
                          }}
                        >
                          複製
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    等待憑證揭露完成...
                  </div>
                </div>
              )}

              {disclosureStep === "completed" && disclosedData && (
                <div className="space-y-3">
                  <p className="text-green-600 dark:text-green-400 font-medium">
                    ✓ 憑證揭露完成
                  </p>
                  <div className="space-y-2 text-sm bg-muted/50 p-4 rounded-lg">
                    <div>
                      <span className="text-muted-foreground">地址：</span>
                      <span className="ml-2 font-medium">{disclosedData.address}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">建築面積：</span>
                      <span className="ml-2 font-medium">{disclosedData.building_area} 坪</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">使用類型：</span>
                      <span className="ml-2 font-medium">{disclosedData.use}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>沒有找到產權憑證</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 步驟 2：房源資訊表單 */}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyRent">月租金 (USDC)</Label>
                <Input
                  id="monthlyRent"
                  type="number"
                  min="1"
                  placeholder="例：1000"
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
                <Select
                  value={formData.depositMonths}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    depositMonths: value
                  }))}
                >
                  <SelectTrigger id="depositMonths">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 個月</SelectItem>
                    <SelectItem value="2">2 個月</SelectItem>
                    <SelectItem value="3">3 個月</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">房源描述</Label>
              <Textarea
                id="description"
                placeholder="描述房源特色、周邊環境、交通等資訊..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  description: e.target.value
                }))}
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>房源照片</Label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <p className="text-muted-foreground">
                  拖放照片到此處，或點擊上傳
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  支援 JPG、PNG 格式，最多 10 張
                </p>
                {/* TODO: 實作圖片上傳功能 */}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              發布房源
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
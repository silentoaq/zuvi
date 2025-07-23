import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Building, RefreshCw } from "lucide-react";
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
import { useAttestation } from "@/hooks/use-attestation";
import { useWallet } from "@/hooks/use-wallet";
import { ImageUpload } from "@/components/image-upload";
import { SolanaService } from "@/services/solana";

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
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

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
      // 儲存完整的 VP Request URI
      if (data.vpRequestUri) {
        sessionStorage.setItem('vpRequestUri', data.vpRequestUri);
      }
      
      // 開始輪詢狀態
      pollDisclosureStatus(data.requestId, token);
    } catch (error) {
      console.error("Disclosure error:", error);
      toast.error("揭露請求失敗");
      setDisclosureStep(null);
      sessionStorage.removeItem('vpRequestUri');
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
          // 清理儲存的 URI
          sessionStorage.removeItem('vpRequestUri');
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
        sessionStorage.removeItem('vpRequestUri');
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

    if (uploadedImages.length === 0) {
      toast.error("請至少上傳一張房源照片");
      return;
    }

    if (!wallet) {
      toast.error("請連接錢包");
      return;
    }

    try {
      setLoading(true);
      
      // 1. 上傳房源詳情到 IPFS
      const token = await createAuthToken();
      
      const propertyDetailsResponse = await fetch('/api/ipfs/upload-property-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          description: formData.description,
          images: uploadedImages,
          features: [],
          amenities: [],
          rules: [],
          location: {
            address: formData.propertyAddress,
            area: formData.buildingArea,
            use: formData.propertyUse
          }
        })
      });

      if (!propertyDetailsResponse.ok) {
        throw new Error('Failed to upload property details');
      }

      const { ipfsHash: propertyDetailsHash } = await propertyDetailsResponse.json();
      
      toast.success("房源詳情已上傳到 IPFS");
      
      // 2. 準備交易
      toast.info("準備發布到區塊鏈...");
      
      const propertyId = `${Date.now()}-${wallet.publicKey.toString().slice(0, 8)}`;
      const ownerAttestation = attestation?.attestations?.twland?.list.find(
        a => a.credentialId === selectedCredentialId
      )?.address || "";
      
      const prepareResult = await SolanaService.prepareListingTransaction({
        propertyId,
        ownerAttestation,
        monthlyRent: parseInt(formData.monthlyRent) * 1_000_000, // 轉換為 USDC 最小單位
        depositMonths: parseInt(formData.depositMonths),
        propertyDetailsHash
      }, token);
      
      // 3. 顯示費用明細
      const { breakdown } = prepareResult;
      const confirmPayment = window.confirm(
        `發布費用明細：\n` +
        `發布費: ${breakdown.listingFee} USDC\n` +
        `手續費: ${breakdown.txFeeInUsdc} USDC\n` +
        `總計: ${breakdown.totalUsdc} USDC\n\n` +
        `確認支付並發布房源？`
      );
      
      if (!confirmPayment) {
        setLoading(false);
        return;
      }
      
      // 4. 簽名交易
      toast.info("請在錢包中簽名交易...");
      
      const transaction = SolanaService.deserializeTransaction(prepareResult.transaction);
      const signedTransaction = await wallet.signTransaction(transaction);
      const serializedTransaction = SolanaService.serializeSignedTransaction(signedTransaction);
      
      // 5. 執行交易
      toast.info("發送交易到區塊鏈...");
      
      const executeResult = await SolanaService.executeTransaction(
        serializedTransaction,
        prepareResult.lastValidBlockHeight,
        token
      );
      
      if (executeResult.confirmed) {
        toast.success("房源發布成功！");
        toast.info(`交易簽名: ${executeResult.signature.slice(0, 20)}...`);
        
        // 6. 導航到房源詳情頁
        setTimeout(() => {
          navigate(`/property/${propertyId}`);
        }, 2000);
      } else {
        throw new Error("Transaction failed to confirm");
      }
      
    } catch (error) {
      console.error("Publish error:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("發布房源失敗");
      }
    } finally {
      setLoading(false);
    }
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
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      處理中...
                    </>
                  ) : (
                    "開始揭露憑證資訊"
                  )}
                </Button>
              )}

              {/* 揭露狀態顯示 */}
              {disclosureStep === "verifying" && (
                <div className="space-y-4">
                  <div className="text-center space-y-4">
                    <p className="text-sm text-muted-foreground">
                      請使用 walletbz 掃描 QR Code 完成憑證揭露
                    </p>
                    {qrCodeUrl && (
                      <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-white rounded-xl shadow-sm">
                          <img src={qrCodeUrl} alt="VP Request QR Code" className="w-32 h-32" />
                        </div>
                        
                        {/* 可複製的網址 */}
                        <div className="w-full max-w-md">
                          <Label className="text-xs text-muted-foreground">或複製此連結：</Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              value={sessionStorage.getItem('vpRequestUri') || ''}
                              readOnly
                              className="text-xs font-mono"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const uri = sessionStorage.getItem('vpRequestUri');
                                if (uri) {
                                  navigator.clipboard.writeText(uri);
                                  toast.success("連結已複製");
                                }
                              }}
                            >
                              複製
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      等待揭露完成...
                    </div>
                  </div>
                </div>
              )}

              {disclosureStep === "completed" && disclosedData && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    ✓ 憑證揭露成功
                  </p>
                  <div className="space-y-1 text-sm">
                    <p>地址：{disclosedData.address}</p>
                    <p>建築面積：{disclosedData.building_area}</p>
                    <p>使用分區：{disclosedData.use}</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-muted-foreground">
              沒有找到產權憑證
            </p>
          )}
        </CardContent>
      </Card>

      {/* 步驟 2：填寫房源資訊 */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>步驟 2：房源資訊</CardTitle>
            <CardDescription>
              填寫房源詳細資訊和租賃條件
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 揭露的資訊（唯讀） */}
            {disclosedData && (
              <>
                <div className="space-y-2">
                  <Label>房源地址</Label>
                  <Input
                    value={formData.propertyAddress}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>建築面積</Label>
                    <Input
                      value={formData.buildingArea}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>使用分區</Label>
                    <Input
                      value={formData.propertyUse}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 可編輯的資訊 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyRent">
                  月租金 (USDC)
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="monthlyRent"
                  type="number"
                  placeholder="10000"
                  value={formData.monthlyRent}
                  onChange={(e) => setFormData(prev => ({ ...prev, monthlyRent: e.target.value }))}
                  required
                  disabled={!disclosedData || loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="depositMonths">
                  押金月數
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.depositMonths}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, depositMonths: value }))}
                  disabled={!disclosedData || loading}
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
              <Label htmlFor="description">
                房源描述
                <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="請描述房源特色、周邊環境、交通便利性等..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={5}
                required
                disabled={!disclosedData || loading}
              />
            </div>
          </CardContent>
        </Card>

        {/* 步驟 3：上傳照片 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>步驟 3：上傳照片</CardTitle>
            <CardDescription>
              至少上傳一張房源照片，最多可上傳 10 張
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImageUpload
              maxFiles={10}
              onImagesChange={setUploadedImages}
              disabled={!disclosedData || loading}
              getAuthToken={createAuthToken}
            />
          </CardContent>
        </Card>

        {/* 提交按鈕 */}
        <div className="mt-6 flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            type="submit"
            disabled={!disclosedData || uploadedImages.length === 0 || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                處理中...
              </>
            ) : (
              "發布房源"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
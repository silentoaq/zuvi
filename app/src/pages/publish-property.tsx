import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Building, Copy, Check } from "lucide-react";
import { Transaction, Connection } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [submitting, setSubmitting] = useState(false);
  const [disclosureStep, setDisclosureStep] = useState<"pending" | "verifying" | "completed" | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [vpRequestUri, setVpRequestUri] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    amenities: {
      hasParking: false,
      hasElevator: false,
      hasBalcony: false,
      hasAirConditioner: false,
      hasWasher: false,
      hasRefrigerator: false,
      hasCookingAllowed: false,
      hasPetAllowed: false,
    },
    rules: {
      noSmoking: false,
      noParty: false,
      quietHours: false,
      visitorRestriction: false,
    },
    location: {
      district: "",
      nearbyMRT: "",
      distanceToMRT: "",
      nearbySchool: "",
      nearbyConvenience: "",
    }
  });

  const [disclosedData, setDisclosedData] = useState<DisclosedData | null>(null);
  const [uploadedImageHashes, setUploadedImageHashes] = useState<string[]>([]);

  const createAuthToken = async () => {
    if (!wallet) throw new Error("Wallet not connected");
    
    const message = `Authenticate for zuvi: ${Date.now()}`;
    const encodedMessage = new TextEncoder().encode(message);
    const { signature } = await wallet.signMessage(encodedMessage);
    
    const signatureBase64 = btoa(String.fromCharCode(...signature));
    return `${wallet.publicKey.toString()}.${signatureBase64}.${btoa(message)}`;
  };

  const handleCopyLink = async () => {
    if (!vpRequestUri) return;
    
    try {
      await navigator.clipboard.writeText(vpRequestUri);
      setCopied(true);
      toast.success("連結已複製到剪貼簿");
      
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      toast.error("複製失敗，請手動複製");
    }
  };

  const handleStartDisclosure = async () => {
    if (!selectedCredentialId) {
      toast.error("請選擇一個產權憑證");
      return;
    }

    try {
      setLoading(true);
      setDisclosureStep("verifying");
      
      const token = await createAuthToken();
      
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
      
      pollDisclosureStatus(data.requestId, token);
    } catch (error) {
      console.error("Disclosure error:", error);
      toast.error("揭露請求失敗");
      setDisclosureStep(null);
      setQrCodeUrl(null);
      setVpRequestUri(null);
    } finally {
      setLoading(false);
    }
  };

  const pollDisclosureStatus = async (requestId: string, token: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/disclosure/status/${requestId}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        const status = await response.json();

        if (status.status === 'completed' && status.disclosedData) {
          setDisclosedData(status.disclosedData);
          setFormData(prev => ({
            ...prev,
            propertyAddress: status.disclosedData.address,
            buildingArea: status.disclosedData.building_area,
            propertyUse: status.disclosedData.use
          }));
          setDisclosureStep("completed");
          toast.success("房產資訊揭露成功");
          setQrCodeUrl(null);
          setVpRequestUri(null);
        } else if (status.status === 'expired' || attempts >= maxAttempts) {
          setDisclosureStep(null);
          setQrCodeUrl(null);
          setVpRequestUri(null);
          toast.error("揭露請求已過期");
        } else {
          attempts++;
          setTimeout(poll, 2000);
        }
      } catch (error) {
        console.error("Poll error:", error);
        setDisclosureStep(null);
        setQrCodeUrl(null);
        setVpRequestUri(null);
        toast.error("揭露狀態查詢失敗");
      }
    };

    poll();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!wallet || !disclosedData) {
      toast.error("請先完成房產資訊揭露");
      return;
    }

    if (!formData.monthlyRent || !formData.description) {
      toast.error("請填寫所有必填欄位");
      return;
    }

    try {
      setSubmitting(true);
      const token = await createAuthToken();
      
      const propertyDetails = {
        description: formData.description,
        images: uploadedImageHashes,
        features: {
          address: disclosedData.address,
          buildingArea: disclosedData.building_area,
          propertyUse: disclosedData.use
        },
        amenities: Object.entries(formData.amenities)
          .filter(([_, value]) => value)
          .map(([key, _]) => key),
        rules: Object.entries(formData.rules)
          .filter(([_, value]) => value)
          .map(([key, _]) => key),
        location: formData.location
      };

      const detailsRes = await fetch('/api/ipfs/upload-property-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(propertyDetails)
      });

      if (!detailsRes.ok) throw new Error('Failed to upload property details');
      const { ipfsHash: propertyDetailsHash } = await detailsRes.json();

      const selectedAttestation = attestation?.attestations?.twland?.list.find(
        att => att.credentialId === selectedCredentialId
      );
      
      if (!selectedAttestation) {
        throw new Error('Attestation not found for selected credential');
      }

      const prepareRes = await fetch('/api/listing/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          selectedCredentialId,
          ownerAttestation: selectedAttestation.address,
          monthlyRent: parseInt(formData.monthlyRent),
          depositMonths: parseInt(formData.depositMonths),
          propertyDetailsHash
        })
      });

      if (!prepareRes.ok) throw new Error('Failed to prepare transaction');
      const prepareData = await prepareRes.json();

      const { transaction: txBase64, listingPda, fees } = prepareData;
      
      const confirmFees = window.confirm(
        `發布費用明細：\n\n` +
        `平台費用：${(fees.listingFeeUsdc / 1_000_000).toFixed(2)} USDC\n` +
        `區塊鏈手續費：${(fees.solCostUsdc / 1_000_000).toFixed(2)} USDC\n` +
        `（SOL 價格：${fees.solPrice.toFixed(2)}）\n\n` +
        `總計：${(fees.totalUsdc / 1_000_000).toFixed(2)} USDC\n\n` +
        `確認支付並發布房源？`
      );
      
      if (!confirmFees) {
        setSubmitting(false);
        return;
      }

      const connection = new Connection(`https://${process.env.REACT_APP_RPC_ROOT || 'api.devnet.solana.com'}`);
      const transaction = Transaction.from(Buffer.from(txBase64, 'base64'));
      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      toast.success("交易已發送，等待確認...");

      const confirmRes = await fetch('/api/listing/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          signature,
          listingPda,
          propertyId: selectedCredentialId
        })
      });

      if (!confirmRes.ok) throw new Error('Transaction confirmation failed');
      
      toast.success("房源發布成功！");
      navigate('/dashboard');
      
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("房源發布失敗");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <div className="mb-6 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">發布房源</h1>
          <p className="text-sm text-muted-foreground mt-1">揭露房產資訊並設定租賃條件</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* 步驟一：選擇並揭露憑證 */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                1
              </div>
              <CardTitle className="text-xl">選擇房產憑證</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 憑證選擇/顯示 */}
            {attestation?.attestations?.twland?.list && attestation.attestations.twland.list.length > 1 ? (
              <Select value={selectedCredentialId} onValueChange={setSelectedCredentialId} disabled={disclosureStep !== null}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選擇一個房產憑證" />
                </SelectTrigger>
                <SelectContent>
                  {attestation.attestations.twland.list.map((cred) => (
                    <SelectItem key={cred.credentialId} value={cred.credentialId}>
                      <div className="font-mono text-xs">
                        {cred.credentialId}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : attestation?.attestations?.twland?.list && attestation.attestations.twland.list.length === 1 && !disclosedData && (
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">已選擇憑證</p>
                    <p className="font-mono text-xs break-all">{selectedCredentialId}</p>
                  </div>
                  <Building className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            )}

            {/* 揭露狀態 */}
            {!disclosedData && !disclosureStep && (
              <Button 
                onClick={handleStartDisclosure}
                disabled={loading || !selectedCredentialId}
                className="w-full"
                size="default"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    處理中...
                  </>
                ) : (
                  "開始揭露房產資訊"
                )}
              </Button>
            )}

            {/* QR Code - 簡化版 */}
            {disclosureStep === "verifying" && qrCodeUrl && (
              <div className="space-y-4">
                <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-6">
                  <div className="mx-auto max-w-sm space-y-4">
                    <p className="text-center text-sm text-muted-foreground">
                      使用 walletbz 掃描 QR Code
                    </p>
                    <div className="flex justify-center">
                      <div className="rounded-xl bg-white p-3 shadow-sm">
                        <img 
                          src={qrCodeUrl} 
                          alt="QR Code" 
                          className="h-48 w-48"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      等待揭露完成
                    </div>
                  </div>
                </div>
                
                {vpRequestUri && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={vpRequestUri}
                      readOnly
                      className="flex-1 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyLink}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* 已揭露資訊 - 簡化版 */}
            {disclosedData && (
              <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 p-4">
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <p className="font-medium text-green-900 dark:text-green-100">
                      房產資訊已揭露
                    </p>
                    <div className="space-y-1 text-sm text-green-800 dark:text-green-200">
                      <p>地址：{disclosedData.address}</p>
                      <p>建坪：{disclosedData.building_area}</p>
                      <p>用途：{disclosedData.use}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 步驟二：填寫租賃資訊 */}
        {disclosedData && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                  2
                </div>
                <CardTitle className="text-xl">設定租賃條件</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 基本資訊 */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="monthlyRent">月租金 (USDC) *</Label>
                    <Input
                      id="monthlyRent"
                      type="number"
                      value={formData.monthlyRent}
                      onChange={(e) => setFormData(prev => ({ ...prev, monthlyRent: e.target.value }))}
                      placeholder="請輸入期望租金"
                      required
                    />
                    <p className="text-xs text-muted-foreground">此為期望租金，可與租客協商</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="depositMonths">押金</Label>
                    <Select 
                      value={formData.depositMonths} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, depositMonths: value }))}
                    >
                      <SelectTrigger>
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
                  <Label htmlFor="description">房源描述 *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="請詳細描述房源特色、格局、採光、通風等資訊..."
                    rows={4}
                    required
                  />
                </div>

                {/* 設施與規則 */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">房屋設施</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries({
                        hasParking: "停車位",
                        hasElevator: "電梯",
                        hasBalcony: "陽台",
                        hasAirConditioner: "冷氣",
                        hasWasher: "洗衣機",
                        hasRefrigerator: "冰箱",
                        hasCookingAllowed: "可開伙",
                        hasPetAllowed: "可養寵物"
                      }).map(([key, label]) => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox 
                            id={key}
                            checked={formData.amenities[key as keyof typeof formData.amenities]}
                            onCheckedChange={(checked) => 
                              setFormData(prev => ({ 
                                ...prev, 
                                amenities: { ...prev.amenities, [key]: !!checked }
                              }))
                            }
                          />
                          <Label htmlFor={key} className="text-sm font-normal cursor-pointer">
                            {label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">租屋規則</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {Object.entries({
                        noSmoking: "禁止吸菸",
                        noParty: "禁止聚會",
                        quietHours: "晚上10點後保持安靜",
                        visitorRestriction: "訪客需登記"
                      }).map(([key, label]) => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox 
                            id={key}
                            checked={formData.rules[key as keyof typeof formData.rules]}
                            onCheckedChange={(checked) => 
                              setFormData(prev => ({ 
                                ...prev, 
                                rules: { ...prev.rules, [key]: !!checked }
                              }))
                            }
                          />
                          <Label htmlFor={key} className="text-sm font-normal cursor-pointer">
                            {label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 位置資訊 */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">位置資訊</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      placeholder="行政區（如：大安區）"
                      value={formData.location.district}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        location: { ...prev.location, district: e.target.value }
                      }))}
                    />
                    <Input
                      placeholder="最近捷運站"
                      value={formData.location.nearbyMRT}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        location: { ...prev.location, nearbyMRT: e.target.value }
                      }))}
                    />
                    <Input
                      placeholder="步行至捷運時間"
                      value={formData.location.distanceToMRT}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        location: { ...prev.location, distanceToMRT: e.target.value }
                      }))}
                    />
                    <Input
                      placeholder="附近學校"
                      value={formData.location.nearbySchool}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        location: { ...prev.location, nearbySchool: e.target.value }
                      }))}
                    />
                  </div>
                  <Textarea
                    placeholder="生活機能描述（便利商店、超市、餐廳等）"
                    value={formData.location.nearbyConvenience}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      location: { ...prev.location, nearbyConvenience: e.target.value }
                    }))}
                    rows={2}
                  />
                </div>

                {/* 房源照片 */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">房源照片 *</h4>
                  <ImageUpload
                    maxFiles={10}
                    onImagesChange={setUploadedImageHashes}
                    disabled={submitting}
                    getAuthToken={createAuthToken}
                  />
                </div>

                {/* 提交按鈕 */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(-1)}
                    disabled={submitting}
                  >
                    取消
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={submitting || uploadedImageHashes.length === 0}
                    className="flex-1"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        發布中...
                      </>
                    ) : (
                      "確認發布"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
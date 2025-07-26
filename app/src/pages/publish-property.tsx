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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAttestation } from "@/hooks/use-attestation";
import { useWallet } from "@/hooks/use-wallet";
import { ImageUpload } from "@/components/image-upload";

interface DisclosedData {
  address: string;
  building_area: string;
  use: string;
}

interface FeeDetails {
  listingFeeUsdc: number;
  solCostUsdc: number;
  totalUsdc: number;
  solPrice: number;
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
  
  const [showFeeDialog, setShowFeeDialog] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<{
    txBase64: string;
    listingPda: string;
    fees: FeeDetails;
  } | null>(null);

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
      hasAirConditioner: false,
      hasWasher: false,
      hasRefrigerator: false,
      hasWaterHeater: false,
      hasInternet: false,
      hasFurniture: false,
    },
    rules: {
      noSmoking: false,
      noPet: false,
      noCooking: false,
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
          propertyUse: disclosedData.use,
        },
        amenities: Object.entries(formData.amenities)
          .filter(([_, value]) => value)
          .map(([key, _]) => key),
        rules: Object.entries(formData.rules)
          .filter(([_, value]) => value)
          .map(([key, _]) => key),
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

      setPendingTransaction({
        txBase64: prepareData.transaction,
        listingPda: prepareData.listingPda,
        fees: prepareData.fees
      });
      setShowFeeDialog(true);
      
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("房源發布失敗");
      setSubmitting(false);
    }
  };

  const handleConfirmTransaction = async () => {
    if (!pendingTransaction || !wallet) return;

    try {
      const connection = new Connection(`https://${process.env.REACT_APP_RPC_ROOT || 'api.devnet.solana.com'}`);
      const transaction = Transaction.from(Buffer.from(pendingTransaction.txBase64, 'base64'));
      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      toast.success("交易已發送，等待確認...");
      setShowFeeDialog(false);

      const token = await createAuthToken();
      const confirmRes = await fetch('/api/listing/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          signature,
          listingPda: pendingTransaction.listingPda,
          propertyId: selectedCredentialId
        })
      });

      if (!confirmRes.ok) throw new Error('Transaction confirmation failed');
      
      toast.success("房源發布成功！");
      navigate('/dashboard');
      
    } catch (error) {
      console.error("Transaction error:", error);
      toast.error("交易失敗");
    } finally {
      setSubmitting(false);
      setPendingTransaction(null);
    }
  };

  const handleCancelTransaction = () => {
    setShowFeeDialog(false);
    setPendingTransaction(null);
    setSubmitting(false);
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
                    準備中...
                  </>
                ) : (
                  '開始揭露房產資訊'
                )}
              </Button>
            )}

            {/* QR Code 顯示 */}
            {disclosureStep === "verifying" && qrCodeUrl && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/20 p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-4">請使用 walletbz 掃描 QR Code 進行揭露</p>
                  <div className="bg-white p-4 rounded-lg inline-block">
                    <img src={qrCodeUrl} alt="VP Request QR Code" className="w-48 h-48" />
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">等待揭露完成...</span>
                  </div>
                </div>
                
                {vpRequestUri && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center">或複製連結在錢包中開啟：</p>
                    <div className="flex gap-2">
                      <Input
                        value={vpRequestUri}
                        readOnly
                        className="text-xs font-mono"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyLink}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 已揭露資訊 */}
            {disclosedData && (
              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">房產資訊已揭露</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">地址：</span>
                    <span className="ml-2">{disclosedData.address}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">建坪：</span>
                    <span className="ml-2">{disclosedData.building_area}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">用途：</span>
                    <span className="ml-2">{disclosedData.use}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 步驟二：設定租賃條件 */}
        <Card className={!disclosedData ? "opacity-50 pointer-events-none" : ""}>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monthlyRent">期望月租金 (USDC)</Label>
                  <Input
                    id="monthlyRent"
                    type="number"
                    value={formData.monthlyRent}
                    onChange={(e) => setFormData(prev => ({ ...prev, monthlyRent: e.target.value }))}
                    placeholder="例：500"
                    required
                  />
                  <p className="text-xs text-muted-foreground">租客可議價</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="depositMonths">押金（月數）</Label>
                  <Select 
                    value={formData.depositMonths} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, depositMonths: value }))}
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

              {/* 房源描述 */}
              <div className="space-y-2">
                <Label htmlFor="description">房源描述</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="請描述房源特色、格局、周邊環境等資訊..."
                  rows={4}
                  required
                />
              </div>

              {/* 設備設施 */}
              <div className="space-y-3">
                <Label>設備設施</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'hasAirConditioner', label: '冷氣' },
                    { key: 'hasWasher', label: '洗衣機' },
                    { key: 'hasRefrigerator', label: '冰箱' },
                    { key: 'hasWaterHeater', label: '熱水器' },
                    { key: 'hasInternet', label: '網路' },
                    { key: 'hasFurniture', label: '基本家具' },
                  ].map(({ key, label }) => (
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

              {/* 租屋規則 */}
              <div className="space-y-3">
                <Label>租屋規則</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'noSmoking', label: '禁止吸煙' },
                    { key: 'noPet', label: '禁止養寵物' },
                    { key: 'noCooking', label: '禁止開伙' },
                  ].map(({ key, label }) => (
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

              {/* 房源照片 */}
              <div className="space-y-2">
                <Label>房源照片（最多10張）</Label>
                <ImageUpload
                  onImagesChange={(hashes: string[]) => setUploadedImageHashes(hashes)}
                  maxFiles={10}
                  getAuthToken={createAuthToken}
                  disabled={submitting}
                />
              </div>

              {/* 提交按鈕 */}
              <Button 
                type="submit" 
                className="w-full"
                disabled={submitting || !disclosedData}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    處理中...
                  </>
                ) : (
                  '發布房源'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* 費用確認對話框 */}
      <AlertDialog open={showFeeDialog} onOpenChange={setShowFeeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認發布費用</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div className="text-sm space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">平台費用</span>
                  <span className="font-medium">
                    {pendingTransaction ? (pendingTransaction.fees.listingFeeUsdc / 1_000_000).toFixed(2) : '0'} USDC
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">區塊鏈手續費</span>
                  <span className="font-medium">
                    {pendingTransaction ? (pendingTransaction.fees.solCostUsdc / 1_000_000).toFixed(2) : '0'} USDC
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-muted-foreground">
                    SOL 價格：${pendingTransaction?.fees.solPrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-2 font-semibold text-base">
                  <span>總計</span>
                  <span className="text-primary">
                    {pendingTransaction ? (pendingTransaction.fees.totalUsdc / 1_000_000).toFixed(2) : '0'} USDC
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                確認支付上述費用並發布房源？
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelTransaction}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmTransaction}>
              確認支付
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
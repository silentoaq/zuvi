import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWallet } from "@/hooks/use-wallet";
import { useAttestation } from "@/hooks/use-attestation";

export function ListPropertyPage() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const { attestation } = useAttestation(wallet?.publicKey?.toString());
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    propertyId: "",
    monthlyRent: "",
    depositMonths: "2",
    address: "",
    description: "",
    area: "",
    rooms: "",
  });

  if (!wallet) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">請先連接錢包</p>
      </div>
    );
  }

  if (!attestation?.hasCitizen || !attestation?.hasProperty) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">需要自然人憑證和房產憑證才能發布房源</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // TODO: 實作發布房源邏輯
      // 1. 上傳詳細資料到 IPFS
      // 2. 準備交易
      // 3. 簽名並執行
      
      console.log("發布房源:", formData);
      
      // 暫時導向首頁
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error) {
      console.error("發布失敗:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">發布房源</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="propertyId">房產編號</Label>
          <Input
            id="propertyId"
            placeholder="例如：A123456789"
            value={formData.propertyId}
            onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="monthlyRent">月租金 (USDC)</Label>
            <Input
              id="monthlyRent"
              type="number"
              min="1"
              placeholder="例如：500"
              value={formData.monthlyRent}
              onChange={(e) => setFormData({ ...formData, monthlyRent: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="depositMonths">押金月數</Label>
            <Input
              id="depositMonths"
              type="number"
              min="1"
              max="3"
              value={formData.depositMonths}
              onChange={(e) => setFormData({ ...formData, depositMonths: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">地址</Label>
          <Input
            id="address"
            placeholder="例如：台北市大安區..."
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="area">坪數</Label>
            <Input
              id="area"
              type="number"
              min="1"
              placeholder="例如：25"
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rooms">房間數</Label>
            <Input
              id="rooms"
              placeholder="例如：2房1廳1衛"
              value={formData.rooms}
              onChange={(e) => setFormData({ ...formData, rooms: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">描述</Label>
          <Textarea
            id="description"
            placeholder="請描述房屋特色、周邊環境等資訊"
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />
        </div>

        <div className="pt-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "發布中..." : "發布房源"}
          </Button>
        </div>
      </form>
    </div>
  );
}
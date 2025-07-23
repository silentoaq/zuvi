import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeeDisplayProps {
  monthlyRent: string;
  className?: string;
}

interface FeeBreakdown {
  listingFee: number;
  estimatedTxFee: number;
  total: number;
}

export function FeeDisplay({ monthlyRent, className }: FeeDisplayProps) {
  const [fees, setFees] = useState<FeeBreakdown | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchFees = async () => {
      try {
        setLoading(true);
        
        // 獲取平台費用（固定）
        const listingFee = 10; // 10 USDC
        
        // 獲取 SOL 價格來估算手續費
        const priceResponse = await fetch('/api/price/sol');
        if (priceResponse.ok) {
          const { price } = await priceResponse.json();
          const estimatedTxFee = (10000 / 1_000_000_000) * price; // ~0.01 SOL
          
          setFees({
            listingFee,
            estimatedTxFee: Math.ceil(estimatedTxFee * 100) / 100,
            total: listingFee + Math.ceil(estimatedTxFee * 100) / 100
          });
        }
      } catch (error) {
        console.error('Failed to fetch fees:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFees();
  }, []);

  if (loading || !fees) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
        計算費用中...
      </div>
    );
  }

  return (
    <div className={cn("space-y-2 text-sm", className)}>
      <div className="font-medium">發布費用預估</div>
      <div className="space-y-1 text-muted-foreground">
        <div className="flex justify-between">
          <span>平台上架費：</span>
          <span>{fees.listingFee} USDC</span>
        </div>
        <div className="flex justify-between">
          <span>網路手續費：</span>
          <span>~{fees.estimatedTxFee} USDC</span>
        </div>
        <div className="flex justify-between font-medium text-foreground pt-1 border-t">
          <span>總計：</span>
          <span>~{fees.total} USDC</span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        * 實際費用可能略有差異
      </div>
    </div>
  );
}
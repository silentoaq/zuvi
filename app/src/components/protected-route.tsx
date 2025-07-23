import { Navigate } from "react-router-dom";
import { useWallet } from "@/hooks/use-wallet";
import { useAttestation } from "@/hooks/use-attestation";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireWallet?: boolean;
  requireCitizen?: boolean;
  requireProperty?: boolean;
}

export function ProtectedRoute({
  children,
  requireWallet = true,
  requireCitizen = false,
  requireProperty = false,
}: ProtectedRouteProps) {
  const { wallet } = useWallet();
  const { attestation, loading } = useAttestation(wallet?.publicKey?.toString());

  // 檢查錢包連接
  if (requireWallet && !wallet) {
    return <Navigate to="/" replace />;
  }

  // 只在首次載入且需要憑證時顯示 loading
  if (loading && (requireCitizen || requireProperty) && attestation === null) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 檢查憑證要求
  if (requireCitizen && !attestation?.hasCitizen) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">需要自然人憑證才能訪問此頁面</p>
      </div>
    );
  }

  if (requireProperty && !attestation?.hasProperty) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">需要房產憑證才能訪問此頁面</p>
      </div>
    );
  }

  return <>{children}</>;
}
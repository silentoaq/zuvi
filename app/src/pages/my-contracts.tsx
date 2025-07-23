import { useWallet } from "@/hooks/use-wallet";

export function MyContractsPage() {
  const { wallet } = useWallet();

  if (!wallet) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">請先連接錢包</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">我的合約</h1>
      <p className="text-muted-foreground">功能開發中</p>
    </div>
  );
}
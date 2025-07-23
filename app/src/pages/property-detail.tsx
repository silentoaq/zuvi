import { useParams } from "react-router-dom";

export function PropertyDetailPage() {
  const { id } = useParams();
  
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">房源詳情</h1>
      <p className="text-muted-foreground">房源 ID: {id}</p>
      <p className="text-muted-foreground mt-4">功能開發中</p>
    </div>
  );
}
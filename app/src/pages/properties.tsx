import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PropertyListing {
  publicKey: string;
  propertyId: string;
  owner: string;
  monthlyRent: number;
  depositMonths: number;
  propertyDetailsHash: string;
  createdAt: number;
}

export function PropertiesPage() {
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const response = await fetch("/api/properties");
        if (!response.ok) {
          throw new Error("Failed to fetch properties");
        }
        
        const data = await response.json();
        setListings(data.listings);
      } catch (err) {
        console.error("Failed to fetch properties:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">載入失敗：{error}</p>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-lg mb-4">目前沒有房源</p>
        <Link 
          to="/list-property" 
          className="text-primary hover:underline"
        >
          成為第一個發布房源的房東
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <Link key={listing.publicKey} to={`/property/${listing.propertyId}`}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">
                房源 {listing.propertyId.slice(0, 8)}...
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">月租金</span>
                  <span className="font-medium">{listing.monthlyRent} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">押金</span>
                  <span className="font-medium">{listing.depositMonths} 個月</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">發布時間</span>
                  <span className="font-medium">
                    {new Date(listing.createdAt * 1000).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
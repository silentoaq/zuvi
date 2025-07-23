export function clearAttestationCache() {
  localStorage.removeItem(CACHE_KEY);
}import { useEffect, useState, useRef } from "react";

interface AttestationStatus {
  hasCitizen: boolean;
  hasProperty: boolean;
  propertyCount: number;
}

const CACHE_KEY = "attestationStatus";
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export function useAttestation(address?: string) {
  const [attestation, setAttestation] = useState<AttestationStatus | null>(() => {
    if (!address) return null;
    
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (data.address === address && Date.now() - data.timestamp < CACHE_DURATION) {
          return data.status;
        }
      } catch (e) {
        localStorage.removeItem(CACHE_KEY);
      }
    }
    
    return null;
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!address) {
      setAttestation(null);
      localStorage.removeItem(CACHE_KEY);
      return;
    }

    // 避免重複請求
    if (fetchingRef.current) return;

    const fetchAttestation = async () => {
      // 檢查快取
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const data = JSON.parse(cached);
          if (data.address === address && Date.now() - data.timestamp < CACHE_DURATION) {
            setAttestation(data.status);
            return;
          }
        } catch (e) {
          localStorage.removeItem(CACHE_KEY);
        }
      }

      fetchingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const did = `did:pkh:sol:${address}`;
        const response = await fetch(`/api/attestation/status/${did}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch attestation status");
        }

        const data = await response.json();
        
        const status: AttestationStatus = {
          hasCitizen: data.hasCitizen,
          hasProperty: data.hasProperty,
          propertyCount: data.propertyCount,
        };

        setAttestation(status);
        
        // 快取結果
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          address,
          status,
          timestamp: Date.now(),
        }));
      } catch (err) {
        console.error("Failed to fetch attestation:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        
        // 如果獲取失敗，使用預設值
        const defaultStatus: AttestationStatus = {
          hasCitizen: false,
          hasProperty: false,
          propertyCount: 0,
        };
        
        setAttestation(defaultStatus);
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    };

    fetchAttestation();
  }, [address]);

  return { attestation, loading, error };
}
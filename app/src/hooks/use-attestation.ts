import { useState, useEffect } from "react";

interface AttestationStatus {
  hasCitizen: boolean;
  hasProperty: boolean;
  propertyCount: number;
}

// 記憶體緩存
const attestationCache = new Map<string, {
  data: AttestationStatus;
  timestamp: number;
}>();

const CACHE_DURATION = 10 * 60 * 1000; // 10 分鐘

// localStorage 緩存 key
const STORAGE_KEY = "zuvi_attestation_cache";

// 從 localStorage 讀取緩存
function loadStorageCache(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const cache = JSON.parse(stored);
      Object.entries(cache).forEach(([key, value]: [string, any]) => {
        if (Date.now() - value.timestamp < CACHE_DURATION) {
          attestationCache.set(key, value);
        }
      });
    }
  } catch (error) {
    console.error("Failed to load attestation cache:", error);
  }
}

// 保存到 localStorage
function saveStorageCache(): void {
  try {
    const cache: Record<string, any> = {};
    attestationCache.forEach((value, key) => {
      if (Date.now() - value.timestamp < CACHE_DURATION) {
        cache[key] = value;
      }
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error("Failed to save attestation cache:", error);
  }
}

// 初始化時載入緩存
loadStorageCache();

export function useAttestation(address?: string) {
  const [attestation, setAttestation] = useState<AttestationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setAttestation(null);
      return;
    }

    const did = `did:pkh:sol:${address}`;
    
    // 檢查緩存
    const cached = attestationCache.get(did);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setAttestation(cached.data);
      return;
    }

    // 查詢憑證狀態
    const fetchAttestation = async () => {
      setLoading(true);
      setError(null);

      try {
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

        // 更新緩存
        attestationCache.set(did, {
          data: status,
          timestamp: Date.now(),
        });
        saveStorageCache();

        setAttestation(status);
      } catch (err) {
        console.error("Failed to fetch attestation:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        
        // 如果有過期的緩存，仍然使用
        if (cached) {
          setAttestation(cached.data);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAttestation();
  }, [address]);

  return { attestation, loading, error };
}
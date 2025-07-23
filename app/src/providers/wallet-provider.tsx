import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";

interface Wallet {
  publicKey: PublicKey;
  signTransaction: (transaction: any) => Promise<any>;
  signAllTransactions: (transactions: any[]) => Promise<any[]>;
  signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
}

interface PropertyCredential {
  address: string;
  merkleRoot: string;
  credentialId: string;
  expiry: number;
}

interface AttestationStatus {
  hasCitizen: boolean;
  hasProperty: boolean;
  propertyCount: number;
  attestations?: {
    twfido?: {
      address: string;
      merkleRoot: string;
      credentialId: string;
      expiry: number;
    } | null;
    twland?: {
      count: number;
      list: PropertyCredential[];
    } | null;
  };
}

interface WalletContextType {
  wallet: Wallet | null;
  attestation: AttestationStatus | null;
  connecting: boolean;
  loading: boolean;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  shortAddress: string;
}

const WalletContext = createContext<WalletContextType | null>(null);

interface PhantomWindow extends Window {
  phantom?: {
    solana?: {
      isPhantom: boolean;
      connect: (options?: { onlyIfTrusted: boolean }) => Promise<{ publicKey: PublicKey }>;
      disconnect: () => Promise<void>;
      on: (event: string, callback: Function) => void;
      publicKey?: PublicKey;
      signTransaction: (transaction: any) => Promise<any>;
      signAllTransactions: (transactions: any[]) => Promise<any[]>;
      signMessage: (message: Uint8Array, display?: string) => Promise<{ signature: Uint8Array }>;
    };
  };
}

// 記憶體緩存
const attestationCache = new Map<string, {
  data: AttestationStatus;
  timestamp: number;
}>();

const CACHE_DURATION = 10 * 60 * 1000; // 10 分鐘

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [attestation, setAttestation] = useState<AttestationStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(false);

  const getPhantom = () => {
    const phantom = (window as PhantomWindow).phantom?.solana;
    if (!phantom?.isPhantom) return null;
    return phantom;
  };

  // 查詢憑證狀態
  const fetchAttestation = useCallback(async (address: string) => {
    const did = `did:pkh:sol:${address}`;
    
    // 檢查緩存
    const cached = attestationCache.get(did);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setAttestation(cached.data);
      return cached.data;
    }

    setLoading(true);
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
        attestations: data.attestations,
      };

      // 更新緩存
      attestationCache.set(did, {
        data: status,
        timestamp: Date.now(),
      });

      setAttestation(status);
      return status;
    } catch (error) {
      console.error("Failed to fetch attestation:", error);
      // 如果有過期的緩存，仍然使用
      if (cached) {
        setAttestation(cached.data);
        return cached.data;
      }
      
      // 設置默認值
      const defaultStatus: AttestationStatus = {
        hasCitizen: false,
        hasProperty: false,
        propertyCount: 0,
      };
      setAttestation(defaultStatus);
      return defaultStatus;
    } finally {
      setLoading(false);
    }
  }, []);

  const connect = async (): Promise<boolean> => {
    const phantom = getPhantom();
    if (!phantom) {
      window.open("https://phantom.app/", "_blank");
      return false;
    }

    setConnecting(true);
    try {
      const response = await phantom.connect();
      
      const walletObj = {
        publicKey: response.publicKey,
        signTransaction: phantom.signTransaction.bind(phantom),
        signAllTransactions: phantom.signAllTransactions.bind(phantom),
        signMessage: phantom.signMessage.bind(phantom),
      };
      
      setWallet(walletObj);
      localStorage.setItem("walletAddress", response.publicKey.toString());
      
      // 連接後立即查詢憑證狀態
      await fetchAttestation(response.publicKey.toString());
      
      return true;
    } catch (error) {
      console.error("Failed to connect:", error);
      return false;
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    const phantom = getPhantom();
    if (phantom) {
      phantom.disconnect().catch(() => {});
    }
    
    setWallet(null);
    setAttestation(null);
    localStorage.removeItem("walletAddress");
  };

  useEffect(() => {
    const phantom = getPhantom();
    if (!phantom) return;

    // 監聽帳戶變更
    const handleAccountChanged = async (publicKey: PublicKey | null) => {
      if (publicKey) {
        const walletObj = {
          publicKey,
          signTransaction: phantom.signTransaction.bind(phantom),
          signAllTransactions: phantom.signAllTransactions.bind(phantom),
          signMessage: phantom.signMessage.bind(phantom),
        };
        
        setWallet(walletObj);
        localStorage.setItem("walletAddress", publicKey.toString());
        
        // 更新憑證狀態
        await fetchAttestation(publicKey.toString());
      } else {
        setWallet(null);
        setAttestation(null);
        localStorage.removeItem("walletAddress");
      }
    };

    phantom.on("accountChanged", handleAccountChanged);

    // 自動連接
    const savedAddress = localStorage.getItem("walletAddress");
    if (savedAddress && phantom.publicKey?.toString() === savedAddress) {
      const walletObj = {
        publicKey: phantom.publicKey,
        signTransaction: phantom.signTransaction.bind(phantom),
        signAllTransactions: phantom.signAllTransactions.bind(phantom),
        signMessage: phantom.signMessage.bind(phantom),
      };
      
      setWallet(walletObj);
      // 自動連接時也查詢憑證
      fetchAttestation(savedAddress);
    } else if (savedAddress) {
      // 嘗試靜默連接
      phantom.connect({ onlyIfTrusted: true }).then(async (response) => {
        if (response.publicKey?.toString() === savedAddress) {
          const walletObj = {
            publicKey: response.publicKey,
            signTransaction: phantom.signTransaction.bind(phantom),
            signAllTransactions: phantom.signAllTransactions.bind(phantom),
            signMessage: phantom.signMessage.bind(phantom),
          };
          
          setWallet(walletObj);
          await fetchAttestation(response.publicKey.toString());
        } else {
          localStorage.removeItem("walletAddress");
        }
      }).catch(() => {
        localStorage.removeItem("walletAddress");
      });
    }
  }, [fetchAttestation]);

  const shortAddress = wallet?.publicKey ? 
    `${wallet.publicKey.toString().slice(0, 4)}...${wallet.publicKey.toString().slice(-4)}` : 
    "";

  const value: WalletContextType = {
    wallet,
    attestation,
    connecting,
    loading,
    connect,
    disconnect,
    shortAddress,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
}

// 單獨的 hook 用於只需要憑證狀態的組件
export function useAttestation() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useAttestation must be used within WalletProvider");
  }
  return {
    attestation: context.attestation,
    loading: context.loading,
  };
}
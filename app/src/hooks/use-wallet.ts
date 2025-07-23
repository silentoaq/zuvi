import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";

interface Wallet {
  publicKey: PublicKey;
  signTransaction: (transaction: any) => Promise<any>;
  signAllTransactions: (transactions: any[]) => Promise<any[]>;
  signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
}

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

export function useWallet() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [connecting, setConnecting] = useState(false);

  const getPhantom = () => {
    const phantom = (window as PhantomWindow).phantom?.solana;
    if (!phantom?.isPhantom) return null;
    return phantom;
  };

  const connect = async () => {
    const phantom = getPhantom();
    if (!phantom) {
      window.open("https://phantom.app/", "_blank");
      return false;
    }

    try {
      setConnecting(true);
      const response = await phantom.connect();
      
      if (response.publicKey) {
        const walletObj = {
          publicKey: response.publicKey,
          signTransaction: phantom.signTransaction.bind(phantom),
          signAllTransactions: phantom.signAllTransactions.bind(phantom),
          signMessage: phantom.signMessage.bind(phantom),
        };
        
        setWallet(walletObj);
        localStorage.setItem("walletAddress", response.publicKey.toString());
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to connect:", err);
      return false;
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    const phantom = getPhantom();
    if (phantom) {
      try {
        await phantom.disconnect();
      } catch (err) {
        console.error("Failed to disconnect:", err);
      }
    }
    
    setWallet(null);
    localStorage.removeItem("walletAddress");
    localStorage.removeItem("attestationStatus");
  };

  useEffect(() => {
    const phantom = getPhantom();
    if (!phantom) return;

    const handleAccountChanged = (publicKey: PublicKey | null) => {
      if (publicKey) {
        const walletObj = {
          publicKey,
          signTransaction: phantom.signTransaction.bind(phantom),
          signAllTransactions: phantom.signAllTransactions.bind(phantom),
          signMessage: phantom.signMessage.bind(phantom),
        };
        
        setWallet(walletObj);
        localStorage.setItem("walletAddress", publicKey.toString());
      } else {
        setWallet(null);
        localStorage.removeItem("walletAddress");
        localStorage.removeItem("attestationStatus");
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
    } else if (savedAddress) {
      // 嘗試靜默連接
      phantom.connect({ onlyIfTrusted: true }).then((response) => {
        if (response.publicKey?.toString() === savedAddress) {
          const walletObj = {
            publicKey: response.publicKey,
            signTransaction: phantom.signTransaction.bind(phantom),
            signAllTransactions: phantom.signAllTransactions.bind(phantom),
            signMessage: phantom.signMessage.bind(phantom),
          };
          
          setWallet(walletObj);
        } else {
          localStorage.removeItem("walletAddress");
          localStorage.removeItem("attestationStatus");
        }
      }).catch(() => {
        localStorage.removeItem("walletAddress");
        localStorage.removeItem("attestationStatus");
      });
    }
  }, []);

  const shortAddress = wallet?.publicKey ? 
    `${wallet.publicKey.toString().slice(0, 4)}...${wallet.publicKey.toString().slice(-4)}` : 
    "";

  return {
    wallet,
    connect,
    disconnect,
    connecting,
    shortAddress,
  };
}
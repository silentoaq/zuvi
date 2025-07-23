import { Request, Response, NextFunction } from 'express';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';

export interface AuthRequest extends Request {
  wallet?: {
    address: string;
    did: string;
  };
}

// 驗證錢包簽名
export async function verifyWallet(
  req: AuthRequest, 
  res: Response, 
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.slice(7);
    const [address, signatureBase64, messageBase64] = token.split('.');
    
    if (!address || !signatureBase64 || !messageBase64) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // 驗證地址格式
    let publicKey: PublicKey;
    try {
      publicKey = new PublicKey(address);
    } catch {
      return res.status(401).json({ error: 'Invalid wallet address' });
    }

    // 解碼簽名和訊息
    const signature = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
    const message = atob(messageBase64);
    const messageBytes = new TextEncoder().encode(message);

    // 驗證簽名
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signature,
      publicKey.toBytes()
    );

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // 檢查時間戳（防止重放攻擊）
    const match = message.match(/Authenticate for zuvi: (\d+)/);
    if (!match) {
      return res.status(401).json({ error: 'Invalid message format' });
    }

    const timestamp = parseInt(match[1]);
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 分鐘

    if (now - timestamp > maxAge) {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    req.wallet = {
      address,
      did: `did:pkh:sol:${address}`
    };
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}
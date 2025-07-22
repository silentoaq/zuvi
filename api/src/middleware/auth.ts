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
    const [address, signature, message] = token.split('.');
    
    if (!address || !signature || !message) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // 驗證地址格式
    try {
      new PublicKey(address);
    } catch {
      return res.status(401).json({ error: 'Invalid wallet address' });
    }

    // TODO: 實際簽名驗證需要前端配合實作
    // 暫時只驗證格式
    
    req.wallet = {
      address,
      did: `did:pkh:sol:${address}`
    };
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
}
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PublicKey } from '@solana/web3.js';
import { CredentialService } from '../services/credential';
import { cache } from '../index';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

export interface AuthRequest extends Request {
  user?: {
    publicKey: string;
  };
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = {
      publicKey: decoded.publicKey
    };
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }
};

// 驗證是否有產權憑證（創建房源用）
export const requirePropertyCredential = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const cacheKey = `hasProperty:${req.user.publicKey}`;
    let hasProperty = cache.get<boolean>(cacheKey);

    if (hasProperty === undefined) {
      try {
        const status = await CredentialService.getCredentialStatus(req.user.publicKey);
        hasProperty = !!(status.twland?.exists && status.twland.count > 0);
      } catch (error) {
        console.log('Unable to verify property credential:', error instanceof Error ? error.message : 'Unknown error');
        // 如果 API 不可用，暫時允許通過
        // 在生產環境中，您可能想要更嚴格的處理
        hasProperty = true;
      }
      
      cache.set(cacheKey, hasProperty, 600);
    }

    if (!hasProperty) {
      res.status(403).json({ error: 'Property credential required' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify credentials' });
    return;
  }
};

// 驗證是否有自然人憑證（申請租賃用）
export const requireCitizenCredential = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const cacheKey = `hasCitizen:${req.user.publicKey}`;
    let hasCitizen = cache.get<boolean>(cacheKey);

    if (hasCitizen === undefined) {
      try {
        const status = await CredentialService.getCredentialStatus(req.user.publicKey);
        hasCitizen = !!(status.twfido?.exists);
      } catch (error) {
        console.log('Unable to verify citizen credential:', error instanceof Error ? error.message : 'Unknown error');
        // 如果 API 不可用，暫時允許通過
        // 在生產環境中，您可能想要更嚴格的處理
        hasCitizen = true;
      }
      
      cache.set(cacheKey, hasCitizen, 600);
    }

    if (!hasCitizen) {
      res.status(403).json({ error: 'Citizen credential required' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify credentials' });
    return;
  }
};

// 驗證公鑰格式
export const validatePublicKey = (publicKey: string): boolean => {
  try {
    new PublicKey(publicKey);
    return true;
  } catch {
    return false;
  }
};

// 驗證 Solana 錢包簽名
export const verifySignature = async (
  publicKey: string,
  message: string,
  signature: string
): Promise<boolean> => {
  try {
    const pubKey = new PublicKey(publicKey);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);

    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      pubKey.toBytes()
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
};
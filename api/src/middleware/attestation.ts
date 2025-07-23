import { Response, NextFunction } from 'express';
import { getTwattestSDK } from '../services/twattest.ts';
import { AuthRequest } from './auth.ts';
import { createLogger } from '../utils/logger.ts';

const logger = createLogger();

// 憑證狀態快取（10分鐘）
const attestationCache = new Map<string, {
  data: any;
  timestamp: number;
}>();

const CACHE_DURATION = 10 * 60 * 1000;

// 需要自然人憑證
export async function requireCitizen(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.wallet) {
      return res.status(401).json({ error: 'Wallet not connected' });
    }

    const cached = attestationCache.get(req.wallet.did);
    let status;

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      status = cached.data;
    } else {
      const twattest = getTwattestSDK();
      status = await twattest.getAttestationStatus(req.wallet.did);
      attestationCache.set(req.wallet.did, {
        data: status,
        timestamp: Date.now()
      });
    }

    if (!status.twfido?.exists) {
      return res.status(403).json({ 
        error: 'Citizen credential required',
        code: 'NO_CITIZEN_CREDENTIAL'
      });
    }

    next();
  } catch (error) {
    logger.error('Attestation check failed:', error);
    res.status(500).json({ error: 'Failed to verify credentials' });
  }
}

// 需要房產憑證
export async function requireProperty(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.wallet) {
      return res.status(401).json({ error: 'Wallet not connected' });
    }

    const cached = attestationCache.get(req.wallet.did);
    let status;

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      status = cached.data;
    } else {
      const twattest = getTwattestSDK();
      status = await twattest.getAttestationStatus(req.wallet.did);
      attestationCache.set(req.wallet.did, {
        data: status,
        timestamp: Date.now()
      });
    }

    if (!status.twfido?.exists) {
      return res.status(403).json({ 
        error: 'Citizen credential required',
        code: 'NO_CITIZEN_CREDENTIAL'
      });
    }

    if (!status.twland?.exists) {
      return res.status(403).json({ 
        error: 'Property credential required',
        code: 'NO_PROPERTY_CREDENTIAL'
      });
    }

    next();
  } catch (error) {
    logger.error('Attestation check failed:', error);
    res.status(500).json({ error: 'Failed to verify credentials' });
  }
}
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { CredentialService } from '../services/credential';
import { ApiError } from '../middleware/errorHandler';
import { validatePublicKey, verifySignature } from '../middleware/auth';

const router = Router();

// 登入介面
interface LoginRequest {
  publicKey: string;
  did: string;
  signature: string; // 簽名訊息證明擁有私鑰
  message: string;   // 被簽名的訊息
}

// 統一登入接口
router.post('/login', async (req, res, next) => {
  try {
    const { publicKey, did, signature, message } = req.body as LoginRequest;

    // 驗證參數
    if (!publicKey || !did || !signature || !message) {
      throw new ApiError(400, 'Missing required fields');
    }

    if (!validatePublicKey(publicKey)) {
      throw new ApiError(400, 'Invalid public key');
    }

    // 驗證簽名
    const isValidSignature = await verifySignature(publicKey, message, signature);
    if (!isValidSignature) {
      throw new ApiError(401, 'Invalid signature');
    }

    // 驗證訊息時效性（5分鐘內）
    const messageData = JSON.parse(message);
    const timestamp = messageData.timestamp;
    const now = Date.now();
    if (!timestamp || Math.abs(now - timestamp) > 5 * 60 * 1000) {
      throw new ApiError(401, 'Message expired');
    }

    // 檢查用戶擁有的憑證
    const credentials = {
      hasPropertyCredential: false,
      hasCitizenCredential: false,
      propertyCount: 0
    };

    // 檢查產權憑證
    try {
      const propertyStatus = await CredentialService.verifyPropertyCredential(did, []);
      credentials.hasPropertyCredential = true;
      credentials.propertyCount = propertyStatus.attestations ? propertyStatus.attestations.length : 0;
    } catch (error) {
      // 沒有產權憑證也沒關係
    }

    // 檢查自然人憑證
    try {
      await CredentialService.verifyCitizenCredential(did, []);
      credentials.hasCitizenCredential = true;
    } catch (error) {
      // 沒有自然人憑證
    }

    // 至少要有一種憑證
    if (!credentials.hasPropertyCredential && !credentials.hasCitizenCredential) {
      throw new ApiError(403, 'No valid credentials found');
    }

    // 生成 JWT
    const token = jwt.sign(
      {
        publicKey,
        did
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        publicKey,
        did,
        credentials
      }
    });
  } catch (error) {
    next(error);
  }
});

// 驗證 token
router.get('/verify', async (req, res, next): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new ApiError(401, 'No token provided');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // 重新檢查憑證狀態
    const credentials = {
      hasPropertyCredential: false,
      hasCitizenCredential: false,
      propertyCount: 0
    };

    try {
      const propertyStatus = await CredentialService.verifyPropertyCredential(decoded.did, []);
      credentials.hasPropertyCredential = true;
      credentials.propertyCount = propertyStatus.attestations ? propertyStatus.attestations.length : 0;
    } catch {}

    try {
      await CredentialService.verifyCitizenCredential(decoded.did, []);
      credentials.hasCitizenCredential = true;
    } catch {}
    
    res.json({
      valid: true,
      user: {
        publicKey: decoded.publicKey,
        did: decoded.did,
        credentials
      }
    });
    return;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.json({ valid: false });
      return;
    }
    next(error);
    return;
  }
});

// 生成登入訊息供錢包簽名
router.post('/message', async (req, res, next) => {
  try {
    const { publicKey } = req.body;

    if (!publicKey || !validatePublicKey(publicKey)) {
      throw new ApiError(400, 'Invalid public key');
    }

    const message = JSON.stringify({
      action: 'Login to Zuvi',
      publicKey,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(7)
    });

    res.json({
      message,
      instructions: 'Please sign this message with your wallet'
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
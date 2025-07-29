import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../middleware/errorHandler';
import { validatePublicKey, verifySignature } from '../middleware/auth';
import { CredentialService } from '../services/credential';

const router = Router();

interface LoginRequest {
  publicKey: string;
  signature: string;
  message: string;
}

// Web3 錢包認證
router.post('/login', async (req, res, next) => {
  try {
    const { publicKey, signature, message } = req.body as LoginRequest;

    if (!publicKey || !signature || !message) {
      throw new ApiError(400, 'Missing required fields');
    }

    if (!validatePublicKey(publicKey)) {
      throw new ApiError(400, 'Invalid public key');
    }

    // 驗證錢包簽名
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

    // 獲取完整憑證狀態
    let credentialStatus = null;
    try {
      credentialStatus = await CredentialService.getCredentialStatus(publicKey);
    } catch (error) {
      // 獲取失敗不影響登錄
      console.log('Credential status unavailable:', error instanceof Error ? error.message : 'Unknown error');
    }

    // 生成 JWT
    const token = jwt.sign(
      {
        publicKey
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        publicKey,
        credentialStatus
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
    
    // 重新獲取憑證狀態
    let credentialStatus = null;
    try {
      credentialStatus = await CredentialService.getCredentialStatus(decoded.publicKey);
    } catch {}
    
    res.json({
      valid: true,
      user: {
        publicKey: decoded.publicKey,
        credentialStatus
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

// 生成錢包簽名訊息
router.post('/message', async (req, res, next) => {
  try {
    const { publicKey } = req.body;

    if (!publicKey || !validatePublicKey(publicKey)) {
      throw new ApiError(400, 'Invalid public key');
    }

    const message = JSON.stringify({
      action: 'Connect to Zuvi',
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
import express from 'express';
import { verifyWallet, AuthRequest } from '../middleware/auth.ts';
import { requireProperty } from '../middleware/attestation.ts';
import { getTwattestSDK } from '../services/twattest.ts';
import { createLogger } from '../utils/logger.ts';

const router = express.Router();
const logger = createLogger();

// 創建揭露請求
router.post('/create', verifyWallet, requireProperty, async (req: AuthRequest, res) => {
  try {
    const { credentialId } = req.body;
    
    if (!credentialId) {
      return res.status(400).json({ error: 'Missing credentialId' });
    }

    const sdk = getTwattestSDK();
    
    // 創建揭露請求
    const disclosureRequest = await sdk.createDisclosureRequest({
      holderDid: req.wallet!.did,
      credentialType: 'PropertyCredential',
      credentialId,
      requiredFields: ['address', 'building_area', 'use'],
      purpose: '發布房源需要揭露房產資訊'
    });

    logger.info('Disclosure request created:', {
      requestId: disclosureRequest.requestId,
      did: req.wallet!.did
    });

    res.json({
      requestId: disclosureRequest.requestId,
      vpRequestUri: disclosureRequest.vpRequestUri,
      qrCodeUrl: sdk.generateQRCodeUrl(disclosureRequest.vpRequestUri),
      expiresAt: disclosureRequest.expiresAt
    });
  } catch (error) {
    logger.error('Failed to create disclosure request:', error);
    res.status(500).json({ error: 'Failed to create disclosure request' });
  }
});

// 查詢揭露狀態
router.get('/status/:requestId', verifyWallet, async (req: AuthRequest, res) => {
  try {
    const { requestId } = req.params;
    const sdk = getTwattestSDK();
    
    const status = await sdk.getDisclosureStatus(requestId);
    
    res.json(status);
  } catch (error) {
    logger.error('Failed to get disclosure status:', error);
    res.status(500).json({ error: 'Failed to get disclosure status' });
  }
});

// 揭露回調（來自 twattest）
router.post('/callback', async (req, res) => {
  try {
    // twattest 會呼叫此 endpoint 回傳揭露結果
    logger.info('Disclosure callback received:', req.body);
    
    // 這裡可以做額外處理，例如儲存到資料庫
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Disclosure callback error:', error);
    res.status(500).json({ error: 'Callback processing failed' });
  }
});

export default router;
import { Router } from 'express';
import { CredentialService } from '../services/credential';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// 創建產權憑證揭露請求
router.post('/property', async (req: AuthRequest, res, next) => {
  try {
    const { credentialId } = req.body;

    if (!credentialId) {
      throw new ApiError(400, 'Missing credential ID');
    }

    const { vpRequestUri, requestId } = await CredentialService.createPropertyDisclosure(
      req.user!.publicKey,
      credentialId
    );

    const qrCodeUrl = CredentialService.generateQRCode(vpRequestUri);

    res.json({
      success: true,
      vpRequestUri,
      requestId,
      qrCodeUrl,
      credentialId
    });
  } catch (error) {
    next(error);
  }
});

// 檢查揭露狀態
router.get('/status/:requestId/:credentialId', async (req: AuthRequest, res, next) => {
  try {
    const { requestId, credentialId } = req.params;

    const result = await CredentialService.waitForDisclosure(
      req.user!.publicKey,
      requestId,
      credentialId
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// 獲取緩存的揭露結果
router.get('/cached/:credentialId', async (req: AuthRequest, res, next) => {
  try {
    const { credentialId } = req.params;

    const result = CredentialService.getCachedDisclosure(
      req.user!.publicKey,
      credentialId
    );

    if (!result) {
      throw new ApiError(404, 'No cached disclosure found');
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export { router as disclosureRouter };
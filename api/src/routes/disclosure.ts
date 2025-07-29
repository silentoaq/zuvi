import { Router } from 'express';
import { CredentialService } from '../services/credential';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// 創建產權憑證揭露請求
router.post('/property', async (req: AuthRequest, res, next): Promise<void> => {
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
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// 檢查揭露狀態（輪詢用）
router.get('/status/:requestId/:credentialId', async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { requestId, credentialId } = req.params;

    // 先檢查緩存的結果
    const cachedResult = CredentialService.getCachedDisclosure(
      req.user!.publicKey,
      credentialId
    );

    if (cachedResult) {
      res.json({
        status: 'completed',
        disclosedData: cachedResult.data,
        success: cachedResult.success,
        error: cachedResult.error
      });
      return;
    }

    // 檢查當前揭露狀態（不等待）
    const status = await CredentialService.getDisclosureStatus(requestId);
    
    // 如果完成了，嘗試驗證和緩存結果
    if (status.status === 'completed' && status.disclosedData) {
      const validationResult = await CredentialService.validateDisclosureData(
        req.user!.publicKey,
        credentialId,
        status.disclosedData
      );
      
      res.json({
        status: 'completed',
        disclosedData: validationResult.success ? validationResult.data : null,
        success: validationResult.success,
        error: validationResult.error
      });
      return;
    }
    
    res.json({
      status: status.status,
      disclosedData: null,
      success: null,
      error: status.error
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// 獲取緩存的揭露結果
router.get('/cached/:credentialId', async (req: AuthRequest, res, next): Promise<void> => {
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
    return;
  } catch (error) {
    next(error);
    return;
  }
});

export { router as disclosureRouter };
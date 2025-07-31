import { Router } from 'express';
import { PinataSDK } from 'pinata-web3';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { StorageService } from '../services/storage';
import { ApiError } from '../middleware/errorHandler';

const router = Router();

// 測試 Pinata 連接狀態
router.get('/pinata-status', authenticateToken, async (_req: AuthRequest, res, next) => {
  try {
    const gateway = process.env.PINATA_GATEWAY!;
    const cleanGateway = gateway.replace('https://', '').replace('/ipfs', '');
    
    const pinata = new PinataSDK({
      pinataJwt: process.env.PINATA_JWT!,
      pinataGateway: cleanGateway
    });

    console.log('[Test] Testing Pinata connection...');

    // 測試上傳一個小檔案來驗證權限
    let testUploadResult;
    try {
      const testData = { test: true, timestamp: Date.now() };
      const blob = new Blob([JSON.stringify(testData)], { type: 'application/json' });
      const file = new File([blob], 'test.json', { type: 'application/json' });
      
      testUploadResult = await pinata.upload.file(file);
      console.log('[Test] Test upload successful:', testUploadResult.IpfsHash);

      // 立即嘗試刪除測試檔案
      try {
        await pinata.unpin([testUploadResult.IpfsHash]);
        console.log('[Test] Test unpin successful');
      } catch (unpinError: any) {
        console.error('[Test] Test unpin failed:', unpinError.message);
      }
    } catch (uploadError: any) {
      console.error('[Test] Test upload failed:', uploadError.message);
      throw new ApiError(500, `Pinata upload test failed: ${uploadError.message}`);
    }

    res.json({
      status: 'connected',
      gateway: cleanGateway,
      testUpload: testUploadResult ? {
        success: true,
        hash: testUploadResult.IpfsHash
      } : {
        success: false
      },
      permissions: {
        canUpload: !!testUploadResult,
        canUnpin: 'check test results'
      }
    });
  } catch (error) {
    next(error);
  }
});

// 測試 unpin 功能
router.post('/test-unpin', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { ipfsHash } = req.body;

    if (!ipfsHash) {
      throw new ApiError(400, 'IPFS hash is required');
    }

    console.log(`[Test] Testing unpin for hash: ${ipfsHash}`);

    // 嘗試 unpin
    const result = await StorageService.unpin(ipfsHash);

    res.json({
      ipfsHash,
      unpinResult: result,
      message: result.success ? 'Successfully unpinned' : `Unpin failed: ${result.reason}`
    });
  } catch (error) {
    next(error);
  }
});

// 測試建立並立即刪除
router.post('/test-create-and-delete', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const testData = {
      type: 'test',
      user: req.user!.publicKey,
      timestamp: Date.now(),
      random: Math.random()
    };

    console.log('[Test] Creating test file...');
    
    // 上傳測試檔案
    const uploadResult = await StorageService.uploadJSON(testData, 'test', req.user!.publicKey);
    console.log('[Test] Test file created:', uploadResult.ipfsHash);

    // 等待一秒
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 嘗試刪除
    console.log('[Test] Attempting to delete test file...');
    const deleteResult = await StorageService.unpin(uploadResult.ipfsHash);

    res.json({
      upload: {
        success: true,
        hash: uploadResult.ipfsHash,
        url: uploadResult.gatewayUrl
      },
      delete: deleteResult,
      overallSuccess: deleteResult.success
    });
  } catch (error) {
    next(error);
  }
});

export { router as testRouter };
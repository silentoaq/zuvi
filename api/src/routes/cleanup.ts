import { Router } from 'express';
import { StorageService } from '../services/storage';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// 清理失敗交易的IPFS內容
router.post('/transaction-failed', async (req: AuthRequest, res, next) => {
  try {
    const { ipfsHashes, imageIds } = req.body;

    if (!ipfsHashes && !imageIds) {
      throw new ApiError(400, 'No content to cleanup');
    }

    const results = {
      jsonsCleaned: 0,
      imagesCleaned: 0,
      errors: [] as string[]
    };

    // 清理JSON內容
    if (ipfsHashes && Array.isArray(ipfsHashes)) {
      for (const hash of ipfsHashes) {
        try {
          await StorageService.unpin(hash);
          results.jsonsCleaned++;
        } catch (error) {
          results.errors.push(`Failed to unpin ${hash}: ${error}`);
        }
      }
    }

    // 清理圖片內容
    if (imageIds && Array.isArray(imageIds)) {
      for (const imageId of imageIds) {
        try {
          await StorageService.unpin(imageId);
          results.imagesCleaned++;
        } catch (error) {
          results.errors.push(`Failed to unpin image ${imageId}: ${error}`);
        }
      }
    }

    res.json({
      success: true,
      results
    });
  } catch (error) {
    next(error);
  }
});

export { router as cleanupRouter };
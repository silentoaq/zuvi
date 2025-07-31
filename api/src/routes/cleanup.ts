import { Router } from 'express';
import { StorageService } from '../services/storage';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// 清理失敗交易的IPFS內容
router.post('/transaction-failed', async (req: AuthRequest, res, next) => {
  try {
    const { ipfsHashes, imageIds } = req.body;

    console.log('[Cleanup] Request received:', {
      ipfsHashes: ipfsHashes?.length || 0,
      imageIds: imageIds?.length || 0,
      user: req.user?.publicKey
    });

    if (!ipfsHashes && !imageIds) {
      throw new ApiError(400, 'No content to cleanup');
    }

    const results = {
      jsonsCleaned: 0,
      jsonsFailed: 0,
      imagesCleaned: 0,
      imagesFailed: 0,
      details: [] as any[],
      errors: [] as string[]
    };

    // 清理JSON內容
    if (ipfsHashes && Array.isArray(ipfsHashes)) {
      console.log(`[Cleanup] Processing ${ipfsHashes.length} IPFS hashes`);
      
      for (const hash of ipfsHashes) {
        try {
          console.log(`[Cleanup] Unpinning hash: ${hash}`);
          const result = await StorageService.unpin(hash);
          
          if (result.success) {
            results.jsonsCleaned++;
            results.details.push({
              hash,
              type: 'json',
              status: 'success'
            });
          } else {
            results.jsonsFailed++;
            results.details.push({
              hash,
              type: 'json',
              status: 'failed',
              reason: result.reason
            });
            results.errors.push(`Failed to unpin ${hash}: ${result.reason}`);
          }
        } catch (error: any) {
          results.jsonsFailed++;
          results.details.push({
            hash,
            type: 'json',
            status: 'error',
            error: error.message
          });
          results.errors.push(`Error unpinning ${hash}: ${error.message}`);
          console.error(`[Cleanup] Error unpinning ${hash}:`, error);
        }
      }
    }

    // 清理圖片內容（imageIds 在這裡應該是 IPFS hashes）
    if (imageIds && Array.isArray(imageIds)) {
      console.log(`[Cleanup] Processing ${imageIds.length} image IDs`);
      
      for (const imageId of imageIds) {
        try {
          console.log(`[Cleanup] Unpinning image: ${imageId}`);
          const result = await StorageService.unpin(imageId);
          
          if (result.success) {
            results.imagesCleaned++;
            results.details.push({
              hash: imageId,
              type: 'image',
              status: 'success'
            });
          } else {
            results.imagesFailed++;
            results.details.push({
              hash: imageId,
              type: 'image',
              status: 'failed',
              reason: result.reason
            });
            results.errors.push(`Failed to unpin image ${imageId}: ${result.reason}`);
          }
        } catch (error: any) {
          results.imagesFailed++;
          results.details.push({
            hash: imageId,
            type: 'image',
            status: 'error',
            error: error.message
          });
          results.errors.push(`Error unpinning image ${imageId}: ${error.message}`);
          console.error(`[Cleanup] Error unpinning image ${imageId}:`, error);
        }
      }
    }

    console.log('[Cleanup] Summary:', {
      jsonsCleaned: results.jsonsCleaned,
      jsonsFailed: results.jsonsFailed,
      imagesCleaned: results.imagesCleaned,
      imagesFailed: results.imagesFailed,
      totalErrors: results.errors.length
    });

    res.json({
      success: true,
      results,
      summary: {
        totalProcessed: (ipfsHashes?.length || 0) + (imageIds?.length || 0),
        totalCleaned: results.jsonsCleaned + results.imagesCleaned,
        totalFailed: results.jsonsFailed + results.imagesFailed
      }
    });
  } catch (error) {
    console.error('[Cleanup] Route error:', error);
    next(error);
  }
});

export { router as cleanupRouter };
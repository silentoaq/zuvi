import { Router } from 'express';
import { CredentialService } from '../services/credential';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// 獲取憑證狀態
router.get('/credentials', async (req: AuthRequest, res, next): Promise<void> => {
  try {
    let credentialStatus = null;
    
    try {
      credentialStatus = await CredentialService.getCredentialStatus(req.user!.publicKey);
    } catch (error) {
    }
    
    res.json({
      credentialStatus
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

export { router as userRouter };
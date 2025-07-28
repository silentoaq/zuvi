import { Router } from 'express';
import { CredentialService } from '../services/credential';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// 獲取憑證狀態
router.get('/credentials', async (req: AuthRequest, res, next) => {
  try {
    const credentialStatus = await CredentialService.getCredentialStatus(req.user!.publicKey);
    
    res.json({
      credentialStatus
    });
  } catch (error) {
    next(error);
  }
});

export { router as userRouter };
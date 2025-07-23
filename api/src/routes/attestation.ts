import express from 'express';
import { getTwattestSDK } from '../services/twattest.ts';
import { createLogger } from '../utils/logger.ts';

const router = express.Router();
const logger = createLogger();

// 查詢憑證狀態
router.get('/status/:did', async (req, res) => {
  try {
    const { did } = req.params;
    
    if (!did.startsWith('did:pkh:sol:')) {
      return res.status(400).json({ 
        error: 'Invalid DID format' 
      });
    }

    const twattest = getTwattestSDK();
    const status = await twattest.getAttestationStatus(did);
    
    // 回傳簡化的狀態資訊
    res.json({
      did,
      hasCitizen: status.twfido?.exists || false,
      hasProperty: status.twland?.exists || false,
      propertyCount: status.twland?.count || 0,
      attestations: {
        twfido: status.twfido?.exists ? {
          address: status.twfido.address,
          merkleRoot: status.twfido.data?.merkleRoot || null,
          credentialId: status.twfido.data?.credentialReference || null,
          expiry: status.twfido.expiry
        } : null,
        twland: status.twland?.exists ? {
          count: status.twland.count,
          list: status.twland.attestations.map(att => ({
            address: att.address,
            merkleRoot: att.data.merkleRoot,
            credentialId: att.data.credentialReference,
            expiry: att.expiry
          }))
        } : null
      }
    });
  } catch (error) {
    logger.error('Failed to get attestation status:', error);
    res.status(500).json({ 
      error: 'Failed to get attestation status' 
    });
  }
});

export default router;
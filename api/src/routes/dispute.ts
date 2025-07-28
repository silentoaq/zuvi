import { Router } from 'express';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { program, derivePDAs, USDC_MINT } from '../config/solana';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { BN } from '@coral-xyz/anchor';

const router = Router();

// 發起爭議
router.post('/raise', async (req: AuthRequest, res, next) => {
  try {
    const { lease, reason } = req.body;
    const userPublicKey = new PublicKey(req.user!.publicKey);

    if (!lease || reason === undefined) {
      throw new ApiError(400, 'Missing required fields');
    }

    // 驗證原因
    if (reason !== 0 && reason !== 1) {
      throw new ApiError(400, 'Invalid dispute reason');
    }

    const leasePubkey = new PublicKey(lease);

    // 檢查租約
    const leaseAccount = await program.account.lease.fetch(leasePubkey);
    if (!leaseAccount.landlord.equals(userPublicKey) && 
        !leaseAccount.tenant.equals(userPublicKey)) {
      throw new ApiError(403, 'Not authorized for this lease');
    }

    const [escrowPda] = derivePDAs.escrow(leasePubkey);
    const [disputePda] = derivePDAs.dispute(leasePubkey);

    const tx = await program.methods
      .raiseDispute(reason)
      .accountsStrict({
        lease: leasePubkey,
        escrow: escrowPda,
        dispute: disputePda,
        initiator: userPublicKey,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64'),
      dispute: disputePda.toString()
    });
  } catch (error) {
    next(error);
  }
});

// 解決爭議 (仲裁者用)
router.post('/:dispute/resolve', async (req: AuthRequest, res, next) => {
  try {
    const { dispute } = req.params;
    const { landlordAmount, tenantAmount } = req.body;
    const userPublicKey = new PublicKey(req.user!.publicKey);

    if (!landlordAmount || !tenantAmount) {
      throw new ApiError(400, 'Missing required amounts');
    }

    const disputePubkey = new PublicKey(dispute);

    // 檢查是否為仲裁者
    const [configPda] = derivePDAs.config();
    const config = await program.account.config.fetch(configPda);
    if (!config.arbitrator.equals(userPublicKey)) {
      throw new ApiError(403, 'Not authorized as arbitrator');
    }

    // 獲取爭議資訊
    const disputeAccount = await program.account.dispute.fetch(disputePubkey);
    const leasePubkey = disputeAccount.lease;
    const leaseAccount = await program.account.lease.fetch(leasePubkey);

    // 檢查金額總和
    const total = new BN(landlordAmount).add(new BN(tenantAmount));
    if (!total.eq(leaseAccount.deposit)) {
      throw new ApiError(400, 'Amount sum does not match deposit');
    }

    const [escrowPda] = derivePDAs.escrow(leasePubkey);
    const [escrowTokenPda] = derivePDAs.escrowToken(leasePubkey);

    // 獲取 token 帳戶
    const landlordToken = await getAssociatedTokenAddress(USDC_MINT, leaseAccount.landlord);
    const tenantToken = await getAssociatedTokenAddress(USDC_MINT, leaseAccount.tenant);

    const tx = await program.methods
      .resolveDispute(
        new BN(landlordAmount),
        new BN(tenantAmount)
      )
      .accountsStrict({
        config: configPda,
        lease: leasePubkey,
        escrow: escrowPda,
        dispute: disputePubkey,
        arbitrator: userPublicKey,
        escrowToken: escrowTokenPda,
        landlordToken,
        tenantToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64'),
      resolution: {
        landlordAmount: landlordAmount.toString(),
        tenantAmount: tenantAmount.toString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// 查詢爭議狀態
router.get('/:dispute', async (req: AuthRequest, res, next) => {
  try {
    const { dispute } = req.params;
    const userPublicKey = new PublicKey(req.user!.publicKey);
    const disputePubkey = new PublicKey(dispute);

    const disputeAccount = await program.account.dispute.fetch(disputePubkey);
    const leaseAccount = await program.account.lease.fetch(disputeAccount.lease);

    // 檢查權限
    const [configPda] = derivePDAs.config();
    const config = await program.account.config.fetch(configPda);
    
    if (!leaseAccount.landlord.equals(userPublicKey) && 
        !leaseAccount.tenant.equals(userPublicKey) &&
        !config.arbitrator.equals(userPublicKey)) {
      throw new ApiError(403, 'Not authorized to view this dispute');
    }

    res.json({
      dispute: {
        publicKey: dispute,
        lease: disputeAccount.lease.toString(),
        initiator: disputeAccount.initiator.toString(),
        reason: disputeAccount.reason,
        status: disputeAccount.status,
        createdAt: disputeAccount.createdAt.toNumber()
      },
      lease: {
        landlord: leaseAccount.landlord.toString(),
        tenant: leaseAccount.tenant.toString(),
        deposit: leaseAccount.deposit.toString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// 查詢所有待處理爭議 (仲裁者用)
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userPublicKey = new PublicKey(req.user!.publicKey);
    
    // 檢查是否為仲裁者
    const [configPda] = derivePDAs.config();
    const config = await program.account.config.fetch(configPda);
    if (!config.arbitrator.equals(userPublicKey)) {
      throw new ApiError(403, 'Not authorized as arbitrator');
    }

    // 獲取所有爭議
    const disputes = await program.account.dispute.all();

    // 過濾待處理的爭議
    const pending = disputes.filter(d => d.account.status === 0);

    // 加載詳細資訊
    const enriched = await Promise.all(
      pending.map(async (dispute) => {
        const lease = await program.account.lease.fetch(dispute.account.lease);
        const listing = await program.account.listing.fetch(lease.listing);

        return {
          publicKey: dispute.publicKey.toString(),
          lease: dispute.account.lease.toString(),
          initiator: dispute.account.initiator.toString(),
          reason: dispute.account.reason,
          createdAt: dispute.account.createdAt.toNumber(),
          leaseInfo: {
            landlord: lease.landlord.toString(),
            tenant: lease.tenant.toString(),
            deposit: lease.deposit.toString(),
            address: Buffer.from(listing.address).toString('utf8').replace(/\0/g, '')
          }
        };
      })
    );

    res.json({
      disputes: enriched,
      total: enriched.length
    });
  } catch (error) {
    next(error);
  }
});

export { router as disputeRouter };
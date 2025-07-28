import { Router } from 'express';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { program, derivePDAs, USDC_MINT } from '../config/solana';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { BN } from '@coral-xyz/anchor';
import { broadcastToUser } from '../ws/websocket';

const router = Router();

// 支付租金
router.post('/rent/:lease', async (req: AuthRequest, res, next) => {
  try {
    const { lease } = req.params;
    const userPublicKey = new PublicKey(req.user!.publicKey);
    const leasePubkey = new PublicKey(lease);

    // 檢查租約
    const leaseAccount = await program.account.lease.fetch(leasePubkey);
    if (!leaseAccount.tenant.equals(userPublicKey)) {
      throw new ApiError(403, 'Not the tenant of this lease');
    }

    // 檢查租約狀態
    if (leaseAccount.status !== 0) {
      throw new ApiError(400, 'Lease is not active');
    }

    // 檢查是否需要支付
    const now = Math.floor(Date.now() / 1000);
    const startDate = leaseAccount.startDate.toNumber();
    const paidMonths = leaseAccount.paidMonths;

    // 計算當前應該支付到第幾個月
    const monthsSinceStart = Math.floor((now - startDate) / (30 * 86400));
    if (paidMonths > monthsSinceStart) {
      throw new ApiError(400, 'Payment not due yet');
    }

    const [configPda] = derivePDAs.config();
    const config = await program.account.config.fetch(configPda);

    // 獲取 token 帳戶
    const tenantToken = await getAssociatedTokenAddress(USDC_MINT, userPublicKey);
    const landlordToken = await getAssociatedTokenAddress(USDC_MINT, leaseAccount.landlord);
    const feeReceiverToken = await getAssociatedTokenAddress(USDC_MINT, config.feeReceiver);

    const tx = await program.methods
      .payRent()
      .accountsStrict({
        config: configPda,
        lease: leasePubkey,
        tenant: userPublicKey,
        tenantToken,
        landlordToken,
        feeReceiverToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    // 通知房東收到租金
    broadcastToUser(leaseAccount.landlord.toString(), {
      type: 'rent_paid',
      lease: lease,
      tenant: userPublicKey.toString(),
      amount: leaseAccount.rent.toString(),
      month: paidMonths + 1,
      message: `收到第 ${paidMonths + 1} 個月租金`
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64'),
      payment: {
        amount: leaseAccount.rent.toString(),
        month: paidMonths + 1
      }
    });
  } catch (error) {
    next(error);
  }
});

// 發起押金結算
router.post('/deposit/:lease/release', async (req: AuthRequest, res, next) => {
  try {
    const { lease } = req.params;
    const { landlordAmount, tenantAmount } = req.body;
    const userPublicKey = new PublicKey(req.user!.publicKey);
    const leasePubkey = new PublicKey(lease);

    if (!landlordAmount || !tenantAmount) {
      throw new ApiError(400, 'Missing required amounts');
    }

    // 檢查租約
    const leaseAccount = await program.account.lease.fetch(leasePubkey);
    if (!leaseAccount.landlord.equals(userPublicKey) && 
        !leaseAccount.tenant.equals(userPublicKey)) {
      throw new ApiError(403, 'Not authorized for this lease');
    }

    // 檢查金額總和
    const total = new BN(landlordAmount).add(new BN(tenantAmount));
    if (!total.eq(leaseAccount.deposit)) {
      throw new ApiError(400, 'Amount sum does not match deposit');
    }

    const [escrowPda] = derivePDAs.escrow(leasePubkey);

    const tx = await program.methods
      .initiateRelease(
        new BN(landlordAmount),
        new BN(tenantAmount)
      )
      .accountsStrict({
        lease: leasePubkey,
        escrow: escrowPda,
        signer: userPublicKey,
      })
      .transaction();

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    // 通知另一方
    const isLandlord = leaseAccount.landlord.equals(userPublicKey);
    const otherParty = isLandlord ? leaseAccount.tenant : leaseAccount.landlord;
    
    broadcastToUser(otherParty.toString(), {
      type: 'deposit_release_initiated',
      lease: lease,
      initiator: userPublicKey.toString(),
      landlordAmount: landlordAmount.toString(),
      tenantAmount: tenantAmount.toString(),
      message: `${isLandlord ? '房東' : '承租人'}發起押金結算，請確認分配方案`
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64'),
      release: {
        landlordAmount: landlordAmount.toString(),
        tenantAmount: tenantAmount.toString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// 確認押金結算
router.post('/deposit/:lease/confirm', async (req: AuthRequest, res, next) => {
  try {
    const { lease } = req.params;
    const userPublicKey = new PublicKey(req.user!.publicKey);
    const leasePubkey = new PublicKey(lease);

    // 檢查租約
    const leaseAccount = await program.account.lease.fetch(leasePubkey);
    if (!leaseAccount.landlord.equals(userPublicKey) && 
        !leaseAccount.tenant.equals(userPublicKey)) {
      throw new ApiError(403, 'Not authorized for this lease');
    }

    const [configPda] = derivePDAs.config();
    const [escrowPda] = derivePDAs.escrow(leasePubkey);
    const [escrowTokenPda] = derivePDAs.escrowToken(leasePubkey);

    // 獲取 token 帳戶
    const landlordToken = await getAssociatedTokenAddress(USDC_MINT, leaseAccount.landlord);
    const tenantToken = await getAssociatedTokenAddress(USDC_MINT, leaseAccount.tenant);

    const tx = await program.methods
      .confirmRelease()
      .accountsStrict({
        config: configPda,
        lease: leasePubkey,
        escrow: escrowPda,
        signer: userPublicKey,
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

    // 通知雙方押金已釋放
    const isLandlord = leaseAccount.landlord.equals(userPublicKey);
    const otherParty = isLandlord ? leaseAccount.tenant : leaseAccount.landlord;
    
    broadcastToUser(otherParty.toString(), {
      type: 'deposit_released',
      lease: lease,
      message: '押金已成功釋放'
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64')
    });
  } catch (error) {
    next(error);
  }
});

// 查詢支付記錄
router.get('/history/:lease', async (req: AuthRequest, res, next) => {
  try {
    const { lease } = req.params;
    const userPublicKey = new PublicKey(req.user!.publicKey);
    const leasePubkey = new PublicKey(lease);

    const leaseAccount = await program.account.lease.fetch(leasePubkey);
    
    // 檢查權限
    if (!leaseAccount.landlord.equals(userPublicKey) && 
        !leaseAccount.tenant.equals(userPublicKey)) {
      throw new ApiError(403, 'Not authorized to view this lease');
    }

    // 計算支付記錄
    const payments = [];
    const startDate = leaseAccount.startDate.toNumber();
    const rent = leaseAccount.rent.toString();
    const paidMonths = leaseAccount.paidMonths;

    for (let i = 0; i < paidMonths; i++) {
      const monthDate = new Date((startDate + i * 30 * 86400) * 1000);
      payments.push({
        month: i + 1,
        amount: rent,
        date: monthDate.toISOString(),
        status: 'paid'
      });
    }

    // 計算下次應付
    const now = Math.floor(Date.now() / 1000);
    const monthsSinceStart = Math.floor((now - startDate) / (30 * 86400));
    let nextPayment = null;

    if (paidMonths <= monthsSinceStart && leaseAccount.status === 0) {
      const nextMonthDate = new Date((startDate + paidMonths * 30 * 86400) * 1000);
      nextPayment = {
        month: paidMonths + 1,
        amount: rent,
        dueDate: nextMonthDate.toISOString(),
        status: 'pending'
      };
    }

    res.json({
      lease: lease,
      paidMonths: paidMonths,
      totalPaid: new BN(rent).mul(new BN(paidMonths)).toString(),
      payments,
      nextPayment
    });
  } catch (error) {
    next(error);
  }
});

export { router as paymentRouter };
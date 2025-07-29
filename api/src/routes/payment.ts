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
    const endDate = leaseAccount.endDate.toNumber();
    const paidMonths = leaseAccount.paidMonths;

    // 計算租期總月數
    const totalMonths = Math.ceil((endDate - startDate) / (30 * 86400));
    
    // 簡化檢查：只要還沒付完且租約還在期限內就可以付
    if (paidMonths >= totalMonths) {
      throw new ApiError(400, 'All rent has been paid');
    }
    
    if (now > endDate) {
      throw new ApiError(400, 'Lease has ended');
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

    // 設置 recentBlockhash
    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;

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

    // 設置 recentBlockhash
    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;

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

    // 設置 recentBlockhash
    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;

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
    const endDate = leaseAccount.endDate.toNumber();
    const rent = leaseAccount.rent.toString();
    const paidMonths = leaseAccount.paidMonths;
    const paymentDay = leaseAccount.paymentDay;
    const totalMonths = Math.ceil((endDate - startDate) / (30 * 86400));

    // 使用實際的月份計算
    const startDateObj = new Date(startDate * 1000);
    
    for (let i = 0; i < paidMonths; i++) {
      const paymentDate = new Date(startDateObj);
      paymentDate.setMonth(startDateObj.getMonth() + i);
      
      // 設定為該月的繳費日
      paymentDate.setDate(Math.min(paymentDay, new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 0).getDate()));
      
      payments.push({
        month: i + 1,
        amount: rent,
        date: paymentDate.toISOString(),
        year: paymentDate.getFullYear(),
        monthName: paymentDate.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' }),
        status: 'paid'
      });
    }

    // 計算下次應付
    const now = Math.floor(Date.now() / 1000);
    let nextPayment = null;

    if (paidMonths < totalMonths && leaseAccount.status === 0 && now <= endDate) {
      const nextPaymentDate = new Date(startDateObj);
      nextPaymentDate.setMonth(startDateObj.getMonth() + paidMonths);
      
      // 設定為該月的繳費日
      nextPaymentDate.setDate(Math.min(paymentDay, new Date(nextPaymentDate.getFullYear(), nextPaymentDate.getMonth() + 1, 0).getDate()));
      
      nextPayment = {
        month: paidMonths + 1,
        amount: rent,
        dueDate: nextPaymentDate.toISOString(),
        year: nextPaymentDate.getFullYear(),
        monthName: nextPaymentDate.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' }),
        status: 'pending'
      };
    }

    res.json({
      lease: lease,
      paidMonths: paidMonths,
      totalMonths: totalMonths,
      remainingMonths: totalMonths - paidMonths,
      totalPaid: new BN(rent).mul(new BN(paidMonths)).toString(),
      totalRent: new BN(rent).mul(new BN(totalMonths)).toString(),
      paymentDay: paymentDay,
      payments,
      nextPayment
    });
  } catch (error) {
    next(error);
  }
});

export { router as paymentRouter };
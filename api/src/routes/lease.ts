import { Router } from 'express';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { program, derivePDAs, USDC_MINT } from '../config/solana';
import { StorageService } from '../services/storage';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { BN, ProgramAccount } from '@coral-xyz/anchor';

const router = Router();

// 創建租約 (房東用)
router.post('/create', async (req: AuthRequest, res, next) => {
  try {
    const { listing, applicant, startDate, endDate, paymentDay, contract } = req.body;
    const userPublicKey = new PublicKey(req.user!.publicKey);

    // 驗證參數
    if (!listing || !applicant || !startDate || !endDate || !paymentDay || !contract) {
      throw new ApiError(400, 'Missing required fields');
    }

    // 驗證日期
    const now = Math.floor(Date.now() / 1000);
    if (startDate < now || startDate > now + 30 * 86400) {
      throw new ApiError(400, 'Start date must be within 30 days');
    }
    if (endDate <= startDate) {
      throw new ApiError(400, 'End date must be after start date');
    }

    // 驗證繳費日
    if (paymentDay < 1 || paymentDay > 28) {
      throw new ApiError(400, 'Payment day must be between 1-28');
    }

    const listingPubkey = new PublicKey(listing);
    const applicantPubkey = new PublicKey(applicant);

    // 檢查權限
    const listingAccount = await program.account.listing.fetch(listingPubkey);
    if (!listingAccount.owner.equals(userPublicKey)) {
      throw new ApiError(403, 'Not the owner of this listing');
    }

    // 上傳合約到 IPFS
    const ipfsResult = await StorageService.uploadJSON(contract, 'contract');

    const [applicationPda] = derivePDAs.application(listingPubkey, applicantPubkey);
    const [leasePda] = derivePDAs.lease(listingPubkey, applicantPubkey);

    const tx = await program.methods
      .createLease(
        applicantPubkey,
        new BN(startDate),
        new BN(endDate),
        paymentDay,
        StorageService.ipfsHashToBytes(ipfsResult.ipfsHash)
      )
      .accountsStrict({
        listing: listingPubkey,
        application: applicationPda,
        lease: leasePda,
        landlord: userPublicKey,
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
      lease: leasePda.toString(),
      contractIpfsHash: ipfsResult.ipfsHash,
      contractUrl: ipfsResult.gatewayUrl
    });
  } catch (error) {
    next(error);
  }
});

// 簽署租約 (承租人用)
router.post('/:lease/sign', async (req: AuthRequest, res, next) => {
  try {
    const { lease } = req.params;
    const userPublicKey = new PublicKey(req.user!.publicKey);
    const leasePubkey = new PublicKey(lease);

    // 檢查租約
    const leaseAccount = await program.account.lease.fetch(leasePubkey);
    if (!leaseAccount.tenant.equals(userPublicKey)) {
      throw new ApiError(403, 'Not the tenant of this lease');
    }

    const [configPda] = derivePDAs.config();
    const config = await program.account.config.fetch(configPda);
    
    const [escrowPda] = derivePDAs.escrow(leasePubkey);
    const [escrowTokenPda] = derivePDAs.escrowToken(leasePubkey);

    // 獲取 token 帳戶地址
    const tenantToken = await getAssociatedTokenAddress(USDC_MINT, userPublicKey);
    const landlordToken = await getAssociatedTokenAddress(USDC_MINT, leaseAccount.landlord);
    const feeReceiverToken = await getAssociatedTokenAddress(USDC_MINT, config.feeReceiver);

    const tx = await program.methods
      .signLease()
      .accountsStrict({
        config: configPda,
        listing: leaseAccount.listing,
        lease: leasePubkey,
        escrow: escrowPda,
        tenant: userPublicKey,
        tenantToken,
        landlordToken,
        feeReceiverToken,
        escrowToken: escrowTokenPda,
        usdcMint: USDC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .transaction();

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64')
    });
  } catch (error) {
    next(error);
  }
});

// 查詢租約詳情
router.get('/:lease', async (req: AuthRequest, res, next) => {
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

    // 獲取合約內容
    const contractIpfsHash = StorageService.bytesToIpfsHash(leaseAccount.contractUri);
    const contract = await StorageService.getJSON(contractIpfsHash);

    // 獲取房源資訊
    const listing = await program.account.listing.fetch(leaseAccount.listing);
    const listingIpfsHash = StorageService.bytesToIpfsHash(listing.metadataUri);
    const listingMetadata = await StorageService.getJSON(listingIpfsHash);

    // 獲取押金狀態
    const [escrowPda] = derivePDAs.escrow(leasePubkey);
    let escrow = null;
    try {
      escrow = await program.account.escrow.fetch(escrowPda);
    } catch {}

    res.json({
      lease: {
        publicKey: lease,
        listing: leaseAccount.listing.toString(),
        landlord: leaseAccount.landlord.toString(),
        tenant: leaseAccount.tenant.toString(),
        tenantAttest: leaseAccount.tenantAttest.toString(),
        rent: leaseAccount.rent.toString(),
        deposit: leaseAccount.deposit.toString(),
        startDate: leaseAccount.startDate.toNumber(),
        endDate: leaseAccount.endDate.toNumber(),
        paymentDay: leaseAccount.paymentDay,
        paidMonths: leaseAccount.paidMonths,
        lastPayment: leaseAccount.lastPayment.toNumber(),
        status: leaseAccount.status,
        landlordSigned: leaseAccount.landlordSigned,
        tenantSigned: leaseAccount.tenantSigned,
        contract,
        contractIpfsHash
      },
      listing: {
        address: Buffer.from(listing.address).toString('utf8').replace(/\0/g, ''),
        buildingArea: listing.buildingArea,
        metadata: listingMetadata
      },
      escrow: escrow ? {
        amount: escrow.amount.toString(),
        status: escrow.status,
        hasDispute: escrow.hasDispute
      } : null
    });
  } catch (error) {
    next(error);
  }
});

// 查詢用戶的所有租約
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userPublicKey = new PublicKey(req.user!.publicKey);
    const { role } = req.query; // 'landlord' or 'tenant'

    type LeaseAccount = Awaited<ReturnType<typeof program.account.lease.fetch>>;
    type LeaseWithRole = ProgramAccount<LeaseAccount> & { role: 'landlord' | 'tenant' };
    let leases: LeaseWithRole[] = [];

    if (role === 'landlord' || !role) {
      // 查詢作為房東的租約
      const landlordLeases = await program.account.lease.all([
        {
          memcmp: {
            offset: 8 + 32, // discriminator + listing
            bytes: userPublicKey.toBase58()
          }
        }
      ]);
      leases = [...leases, ...landlordLeases.map(l => ({ ...l, role: 'landlord' as const }))];
    }

    if (role === 'tenant' || !role) {
      // 查詢作為承租人的租約
      const tenantLeases = await program.account.lease.all([
        {
          memcmp: {
            offset: 8 + 32 + 32, // discriminator + listing + landlord
            bytes: userPublicKey.toBase58()
          }
        }
      ]);
      leases = [...leases, ...tenantLeases.map(l => ({ ...l, role: 'tenant' as const }))];
    }

    // 加載詳細資訊
    const enriched = await Promise.all(
      leases.map(async (lease) => {
        const listing = await program.account.listing.fetch(lease.account.listing);
        const listingIpfsHash = StorageService.bytesToIpfsHash(listing.metadataUri);
        const listingMetadata = await StorageService.getJSON(listingIpfsHash);

        return {
          publicKey: lease.publicKey.toString(),
          role: lease.role,
          listing: {
            publicKey: lease.account.listing.toString(),
            address: Buffer.from(listing.address).toString('utf8').replace(/\0/g, ''),
            metadata: listingMetadata
          },
          rent: lease.account.rent.toString(),
          deposit: lease.account.deposit.toString(),
          startDate: lease.account.startDate.toNumber(),
          endDate: lease.account.endDate.toNumber(),
          status: lease.account.status,
          paidMonths: lease.account.paidMonths
        };
      })
    );

    res.json({
      leases: enriched,
      total: enriched.length
    });
  } catch (error) {
    next(error);
  }
});

export { router as leaseRouter };
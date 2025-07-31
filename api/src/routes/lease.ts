import { Router } from 'express';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { program, derivePDAs, USDC_MINT } from '../config/solana';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { StorageService } from '../services/storage';
import { BN } from '@coral-xyz/anchor';
import { broadcastToUser } from '../ws/websocket';

const router = Router();

// 創建租約 (房東)
router.post('/create', async (req: AuthRequest, res, next) => {
  try {
    const { listing, applicant, startDate, endDate, paymentDay, contract } = req.body;
    const userPublicKey = new PublicKey(req.user!.publicKey);

    if (!listing || !applicant || !startDate || !endDate || !paymentDay || !contract) {
      throw new ApiError(400, 'Missing required fields');
    }

    const listingPubkey = new PublicKey(listing);
    const applicantPubkey = new PublicKey(applicant);

    // 檢查房源所有權
    const listingAccount = await program.account.listing.fetch(listingPubkey);
    if (!listingAccount.owner.equals(userPublicKey)) {
      throw new ApiError(403, 'Not the owner of this listing');
    }

    // 檢查房源狀態
    if (listingAccount.status !== 0) {
      throw new ApiError(400, 'Listing is not available');
    }

    // 找到對應的申請
    const applications = await program.account.application.all([
      {
        memcmp: {
          offset: 8,
          bytes: listingPubkey.toBase58()
        }
      },
      {
        memcmp: {
          offset: 8 + 32,
          bytes: applicantPubkey.toBase58()
        }
      }
    ]);

    const approvedApp = applications.find(app => app.account.status === 1);
    if (!approvedApp) {
      throw new ApiError(404, 'No approved application found');
    }

    const application = approvedApp;
    const applicationCreatedAt = application.account.createdAt;

    // 上傳合約到 IPFS
    const ipfsResult = await StorageService.uploadJSON(contract, 'lease', req.user!.publicKey);
    const contractUriBytes = StorageService.ipfsHashToBytes(ipfsResult.ipfsHash);

    const startDateBN = new BN(startDate);
    const endDateBN = new BN(endDate);

    const [leasePda] = derivePDAs.lease(listingPubkey, applicantPubkey, startDateBN);

    const tx = await program.methods
      .createLease(
        applicantPubkey,
        applicationCreatedAt,
        startDateBN,
        endDateBN,
        paymentDay,
        Array.from(contractUriBytes)
      )
      .accountsStrict({
        listing: listingPubkey,
        application: application.publicKey,
        lease: leasePda,
        landlord: userPublicKey,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    // 通知承租人
    broadcastToUser(applicant, {
      type: 'lease_created',
      lease: leasePda.toString(),
      listing: listing,
      landlord: userPublicKey.toString(),
      message: '房東已創建租約，請簽署確認'
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64'),
      lease: leasePda.toString(),
      cleanup: {
        contractIpfsHash: ipfsResult.ipfsHash
      }
    });
  } catch (error) {
    next(error);
  }
});

// 簽署租約 (承租人)
router.post('/:lease/sign', async (req: AuthRequest, res, next) => {
  try {
    const { lease } = req.params;
    const userPublicKey = new PublicKey(req.user!.publicKey);
    const leasePubkey = new PublicKey(lease);

    const leaseAccount = await program.account.lease.fetch(leasePubkey);
    if (!leaseAccount.tenant.equals(userPublicKey)) {
      throw new ApiError(403, 'Not the tenant of this lease');
    }

    if (leaseAccount.tenantSigned) {
      throw new ApiError(400, 'Already signed');
    }

    const [configPda] = derivePDAs.config();
    const [escrowPda] = derivePDAs.escrow(leasePubkey);
    const [escrowTokenPda] = derivePDAs.escrowToken(leasePubkey);

    // 獲取 token 帳戶
    const tenantToken = await getAssociatedTokenAddress(USDC_MINT, userPublicKey);
    const landlordToken = await getAssociatedTokenAddress(USDC_MINT, leaseAccount.landlord);

    // 獲取配置以取得手續費接收者
    const config = await program.account.config.fetch(configPda);
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
        rent: new PublicKey('SysvarRent111111111111111111111111111111111'),
      })
      .transaction();

    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    // 通知房東
    broadcastToUser(leaseAccount.landlord.toString(), {
      type: 'lease_signed',
      lease: lease,
      tenant: userPublicKey.toString(),
      message: '承租人已簽署租約，押金已託管'
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64')
    });
  } catch (error) {
    next(error);
  }
});

// 查詢單一租約
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

    // 載入合約內容
    let contract = null;
    try {
      const contractHash = StorageService.bytesToIpfsHash(leaseAccount.contractUri);
      contract = await StorageService.getJSON(contractHash);
    } catch (error) {
      console.error('Error loading contract:', error);
    }

    // 載入房源資訊
    const listing = await program.account.listing.fetch(leaseAccount.listing);
    let listingMetadata = null;
    try {
      const metadataHash = StorageService.bytesToIpfsHash(listing.metadataUri);
      listingMetadata = await StorageService.getJSON(metadataHash);
    } catch (error) {
      console.error('Error loading listing metadata:', error);
    }

    // 檢查託管狀態
    let escrow = null;
    try {
      const [escrowPda] = derivePDAs.escrow(leasePubkey);
      escrow = await program.account.escrow.fetch(escrowPda);
    } catch (error) {
      // 託管帳戶可能尚未創建
    }

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
        contract
      },
      listing: {
        address: Buffer.from(listing.address).toString('utf8').replace(/\0/g, ''),
        buildingArea: listing.buildingArea,
        metadata: listingMetadata
      },
      escrow: escrow ? {
        amount: escrow.amount.toString(),
        status: escrow.status,
        releaseToLandlord: escrow.releaseToLandlord.toString(),
        releaseToTenant: escrow.releaseToTenant.toString(),
        landlordSigned: escrow.landlordSigned,
        tenantSigned: escrow.tenantSigned,
        hasDispute: escrow.hasDispute
      } : null
    });
  } catch (error) {
    next(error);
  }
});

// 查詢所有租約
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userPublicKey = new PublicKey(req.user!.publicKey);

    // 獲取作為房東的租約
    const landlordLeases = await program.account.lease.all([
      {
        memcmp: {
          offset: 8 + 32,
          bytes: userPublicKey.toBase58()
        }
      }
    ]);

    // 獲取作為承租人的租約
    const tenantLeases = await program.account.lease.all([
      {
        memcmp: {
          offset: 8 + 32 + 32,
          bytes: userPublicKey.toBase58()
        }
      }
    ]);

    // 合併並去重
    const allLeases = [...landlordLeases, ...tenantLeases];
    const uniqueLeases = Array.from(
      new Map(allLeases.map(lease => [lease.publicKey.toString(), lease])).values()
    );

    // 加載詳細資訊
    const enriched = await Promise.all(
      uniqueLeases.map(async (lease) => {
        try {
          const listing = await program.account.listing.fetch(lease.account.listing);
          const listingIpfsHash = StorageService.bytesToIpfsHash(listing.metadataUri);
          const listingMetadata = await StorageService.getJSON(listingIpfsHash);

          // 檢查託管狀態
          let escrow = null;
          try {
            const [escrowPda] = derivePDAs.escrow(lease.publicKey);
            escrow = await program.account.escrow.fetch(escrowPda);
          } catch (error) {
            // 託管帳戶可能尚未創建
          }

          return {
            publicKey: lease.publicKey.toString(),
            listing: lease.account.listing.toString(),
            landlord: lease.account.landlord.toString(),
            tenant: lease.account.tenant.toString(),
            rent: lease.account.rent.toString(),
            deposit: lease.account.deposit.toString(),
            startDate: lease.account.startDate.toNumber(),
            endDate: lease.account.endDate.toNumber(),
            paymentDay: lease.account.paymentDay,
            paidMonths: lease.account.paidMonths,
            status: lease.account.status,
            landlordSigned: lease.account.landlordSigned,
            tenantSigned: lease.account.tenantSigned,
            listingInfo: {
              address: Buffer.from(listing.address).toString('utf8').replace(/\0/g, ''),
              buildingArea: listing.buildingArea,
              metadata: listingMetadata
            },
            escrow: escrow ? {
              amount: escrow.amount.toString(),
              status: escrow.status,
              releaseToLandlord: escrow.releaseToLandlord.toString(),
              releaseToTenant: escrow.releaseToTenant.toString(),
              landlordSigned: escrow.landlordSigned,
              tenantSigned: escrow.tenantSigned,
              hasDispute: escrow.hasDispute
            } : null
          };
        } catch (error) {
          console.error('Error processing lease:', error);
          return {
            publicKey: lease.publicKey.toString(),
            listing: lease.account.listing.toString(),
            landlord: lease.account.landlord.toString(),
            tenant: lease.account.tenant.toString(),
            rent: lease.account.rent.toString(),
            deposit: lease.account.deposit.toString(),
            startDate: lease.account.startDate.toNumber(),
            endDate: lease.account.endDate.toNumber(),
            paymentDay: lease.account.paymentDay,
            paidMonths: lease.account.paidMonths,
            status: lease.account.status,
            landlordSigned: lease.account.landlordSigned,
            tenantSigned: lease.account.tenantSigned,
            listingInfo: null
          };
        }
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
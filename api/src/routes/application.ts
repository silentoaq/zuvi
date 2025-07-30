import { Router } from 'express';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { program, derivePDAs, apiSignerWallet } from '../config/solana';
import { StorageService } from '../services/storage';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { broadcastToUser } from '../ws/websocket';

const router = Router();

// 申請租賃
router.post('/apply', async (req: AuthRequest, res, next) => {
  try {
    const { listing, tenantAttest, message } = req.body;
    const userPublicKey = new PublicKey(req.user!.publicKey);

    if (!listing || !tenantAttest || !message) {
      throw new ApiError(400, 'Missing required fields');
    }

    const listingPubkey = new PublicKey(listing);
    const tenantAttestPubkey = new PublicKey(tenantAttest);
    
    // 檢查房源狀態
    const listingAccount = await program.account.listing.fetch(listingPubkey);
    if (listingAccount.status !== 0) {
      throw new ApiError(400, 'Listing not available');
    }

    // 檢查是否為自己的房源
    if (listingAccount.owner.equals(userPublicKey)) {
      throw new ApiError(400, 'Cannot apply to own listing');
    }

    // 上傳申請資料到 IPFS
    const ipfsResult = await StorageService.uploadJSON(message, 'apply', req.user!.publicKey);
    
    const [applicationPda] = derivePDAs.application(listingPubkey, userPublicKey);

    const [configPda] = derivePDAs.config();

    const tx = await program.methods
      .applyLease(StorageService.ipfsHashToBytes(ipfsResult.ipfsHash))
      .accountsStrict({
        config: configPda,
        listing: listingPubkey,
        application: applicationPda,
        applicant: userPublicKey,
        apiSigner: apiSignerWallet.publicKey,
        tenantAttest: tenantAttestPubkey,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    // 設置 recentBlockhash
    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;
    
    // API 簽名者簽署交易
    tx.partialSign(apiSignerWallet.payer);

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64'),
      application: applicationPda.toString(),
      ipfsHash: ipfsResult.ipfsHash
    });
  } catch (error) {
    next(error);
  }
});

// 查詢房源的所有申請 (房東用)
router.get('/listing/:listing', async (req: AuthRequest, res, next) => {
  try {
    const { listing } = req.params;
    const userPublicKey = new PublicKey(req.user!.publicKey);
    const listingPubkey = new PublicKey(listing);

    // 檢查是否為房東
    const listingAccount = await program.account.listing.fetch(listingPubkey);
    if (!listingAccount.owner.equals(userPublicKey)) {
      throw new ApiError(403, 'Not the owner of this listing');
    }

    // 獲取所有申請
    const applications = await program.account.application.all([
      {
        memcmp: {
          offset: 8,
          bytes: listingPubkey.toBase58()
        }
      }
    ]);

    // 加載 IPFS 資料
    const enriched = await Promise.all(
      applications.map(async (app) => {
        const ipfsHash = StorageService.bytesToIpfsHash(app.account.messageUri);
        const message = await StorageService.getJSON(ipfsHash);
        
        return {
          publicKey: app.publicKey.toString(),
          applicant: app.account.applicant.toString(),
          tenantAttest: app.account.tenantAttest.toString(),
          status: app.account.status,
          createdAt: app.account.createdAt.toNumber(),
          message,
          ipfsHash
        };
      })
    );

    res.json({
      applications: enriched,
      total: enriched.length
    });
  } catch (error) {
    next(error);
  }
});

// 查詢用戶的所有申請
router.get('/my', async (req: AuthRequest, res, next) => {
  try {
    const userPublicKey = new PublicKey(req.user!.publicKey);

    const applications = await program.account.application.all([
      {
        memcmp: {
          offset: 8 + 32,
          bytes: userPublicKey.toBase58()
        }
      }
    ]);

    const enriched = await Promise.all(
      applications.map(async (app) => {
        const ipfsHash = StorageService.bytesToIpfsHash(app.account.messageUri);
        const message = await StorageService.getJSON(ipfsHash);
        
        // 獲取房源資訊
        const listing = await program.account.listing.fetch(app.account.listing);
        const listingIpfsHash = StorageService.bytesToIpfsHash(listing.metadataUri);
        const listingMetadata = await StorageService.getJSON(listingIpfsHash);
        
        return {
          publicKey: app.publicKey.toString(),
          listing: app.account.listing.toString(),
          listingInfo: {
            address: Buffer.from(listing.address).toString('utf8').replace(/\0/g, ''),
            rent: listing.rent.toString(),
            deposit: listing.deposit.toString(),
            metadata: listingMetadata
          },
          status: app.account.status,
          createdAt: app.account.createdAt.toNumber(),
          messageData: message,
          ipfsHash
        };
      })
    );

    res.json({
      applications: enriched,
      total: enriched.length
    });
  } catch (error) {
    next(error);
  }
});

// 核准申請 (房東用)
router.post('/:listing/approve/:applicant', async (req: AuthRequest, res, next) => {
  try {
    const { listing, applicant } = req.params;
    const userPublicKey = new PublicKey(req.user!.publicKey);
    const listingPubkey = new PublicKey(listing);
    const applicantPubkey = new PublicKey(applicant);

    // 檢查是否為房東
    const listingAccount = await program.account.listing.fetch(listingPubkey);
    if (!listingAccount.owner.equals(userPublicKey)) {
      throw new ApiError(403, 'Not the owner of this listing');
    }

    const [applicationPda] = derivePDAs.application(listingPubkey, applicantPubkey);

    const tx = await program.methods
      .approveApplication(applicantPubkey)
      .accountsStrict({
        listing: listingPubkey,
        application: applicationPda,
        owner: userPublicKey,
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

    // 通知承租人申請已核准
    broadcastToUser(applicant, {
      type: 'application_approved',
      listing: listing,
      landlord: userPublicKey.toString(),
      message: '您的租賃申請已被核准'
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64')
    });
  } catch (error) {
    next(error);
  }
});

// 拒絕申請 (房東用)
router.post('/:listing/reject/:applicant', async (req: AuthRequest, res, next) => {
  try {
    const { listing, applicant } = req.params;
    const userPublicKey = new PublicKey(req.user!.publicKey);
    const listingPubkey = new PublicKey(listing);
    const applicantPubkey = new PublicKey(applicant);

    // 檢查是否為房東
    const listingAccount = await program.account.listing.fetch(listingPubkey);
    if (!listingAccount.owner.equals(userPublicKey)) {
      throw new ApiError(403, 'Not the owner of this listing');
    }

    const [applicationPda] = derivePDAs.application(listingPubkey, applicantPubkey);

    const tx = await program.methods
      .rejectApplication(applicantPubkey)
      .accountsStrict({
        listing: listingPubkey,
        application: applicationPda,
        owner: userPublicKey,
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

    // 通知承租人申請已拒絕
    broadcastToUser(applicant, {
      type: 'application_rejected',
      listing: listing,
      landlord: userPublicKey.toString(),
      message: '您的租賃申請已被拒絕'
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64')
    });
  } catch (error) {
    next(error);
  }
});

// 關閉申請 (承租人用)
router.delete('/:application', async (req: AuthRequest, res, next) => {
  try {
    const { application } = req.params;
    const userPublicKey = new PublicKey(req.user!.publicKey);
    const applicationPubkey = new PublicKey(application);

    // 檢查是否為申請人
    const applicationAccount = await program.account.application.fetch(applicationPubkey);
    if (!applicationAccount.applicant.equals(userPublicKey)) {
      throw new ApiError(403, 'Not the applicant of this application');
    }

    // 檢查申請狀態
    if (applicationAccount.status !== 0) {
      throw new ApiError(400, 'Can only close pending applications');
    }

    const tx = await program.methods
      .closeApplication()
      .accountsStrict({
        application: applicationPubkey,
        applicant: userPublicKey,
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

    // 通知房東申請已撤回
    const listingAccount = await program.account.listing.fetch(applicationAccount.listing);
    broadcastToUser(listingAccount.owner.toString(), {
      type: 'application_closed',
      listing: applicationAccount.listing.toString(),
      applicant: userPublicKey.toString(),
      message: '承租人已撤回申請'
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64')
    });
  } catch (error) {
    next(error);
  }
});

export { router as applicationRouter };
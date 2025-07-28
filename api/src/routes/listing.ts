import { Router } from 'express';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { program, derivePDAs, apiSignerWallet } from '../config/solana';
import { CredentialService } from '../services/credential';
import { StorageService } from '../services/storage';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest, requirePropertyCredential } from '../middleware/auth';
import { cache } from '../index';
import { BN } from '@coral-xyz/anchor';

const router = Router();

// 創建房源
router.post('/create', requirePropertyCredential, async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { propertyAttest, rent, deposit, metadata } = req.body;
    const userPublicKey = new PublicKey(req.user!.publicKey);

    // 驗證參數
    if (!propertyAttest || !rent || !deposit || !metadata) {
      throw new ApiError(400, 'Missing required fields');
    }

    // 驗證押金範圍 (1-3個月租金)
    if (deposit < rent || deposit > rent * 3) {
      throw new ApiError(400, 'Deposit must be between 1-3 months rent');
    }

    // 驗證產權憑證並取得揭露資料
    const credential = await CredentialService.verifyPropertyCredential(
      req.user!.did,
      ['address', 'buildingArea', 'use']
    );

    if (!credential.verified) {
      throw new ApiError(403, 'Property credential verification failed');
    }

    // 檢查用途必須是住宅
    if (credential.data.use !== '住宅') {
      throw new ApiError(400, 'Property must be residential');
    }

    // 上傳 metadata 到 IPFS
    const ipfsResult = await StorageService.uploadJSON(metadata, 'listing');
    
    // 準備鏈上資料
    const addressBytes = Buffer.alloc(64);
    addressBytes.write(credential.data.address);
    
    const propertyAttestPubkey = new PublicKey(propertyAttest);
    const [listingPda] = derivePDAs.listing(propertyAttestPubkey);
    const [configPda] = derivePDAs.config();

    // 創建交易
    const tx = await program.methods
      .createListing(
        Array.from(addressBytes),
        credential.data.buildingArea,
        new BN(rent),
        new BN(deposit),
        StorageService.ipfsHashToBytes(ipfsResult.ipfsHash)
      )
      .accountsStrict({
        config: configPda,
        listing: listingPda,
        owner: userPublicKey,
        apiSigner: apiSignerWallet.publicKey,
        propertyAttest: propertyAttestPubkey,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    // API 簽名交易
    tx.partialSign(apiSignerWallet.payer);

    // 序列化交易供前端簽名
    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64'),
      listing: listingPda.toString(),
      ipfsHash: ipfsResult.ipfsHash,
      gatewayUrl: ipfsResult.gatewayUrl
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// 查詢房源列表
router.get('/', async (req, res, next): Promise<void> => {
  try {
    const { status, owner, page = 1, limit = 20 } = req.query;
    
    const cacheKey = `listings:${status}:${owner}:${page}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    // 獲取所有房源帳戶
    const listings = await program.account.listing.all();

    // 過濾
    let filtered = listings;
    if (status !== undefined) {
      filtered = filtered.filter(l => l.account.status === Number(status));
    }
    if (owner) {
      filtered = filtered.filter(l => l.account.owner.toString() === owner);
    }

    // 分頁
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginated = filtered.slice(startIndex, endIndex);

    // 加載 IPFS 資料
    const enriched = await Promise.all(
      paginated.map(async (listing) => {
        const ipfsHash = StorageService.bytesToIpfsHash(listing.account.metadataUri);
        const metadata = await StorageService.getJSON(ipfsHash);
        
        return {
          publicKey: listing.publicKey.toString(),
          owner: listing.account.owner.toString(),
          propertyAttest: listing.account.propertyAttest.toString(),
          address: Buffer.from(listing.account.address).toString('utf8').replace(/\0/g, ''),
          buildingArea: listing.account.buildingArea,
          rent: listing.account.rent.toString(),
          deposit: listing.account.deposit.toString(),
          status: listing.account.status,
          currentTenant: listing.account.currentTenant,
          createdAt: listing.account.createdAt.toNumber(),
          metadata,
          ipfsHash
        };
      })
    );

    const result = {
      listings: enriched,
      pagination: {
        total: filtered.length,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(filtered.length / Number(limit))
      }
    };

    cache.set(cacheKey, result, 300); // 緩存5分鐘
    res.json(result);
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// 查詢單一房源
router.get('/:publicKey', async (req, res, next): Promise<void> => {
  try {
    const { publicKey } = req.params;
    
    const cacheKey = `listing:${publicKey}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const listingPubkey = new PublicKey(publicKey);
    const listing = await program.account.listing.fetch(listingPubkey);

    const ipfsHash = StorageService.bytesToIpfsHash(listing.metadataUri);
    const metadata = await StorageService.getJSON(ipfsHash);

    const result = {
      publicKey,
      owner: listing.owner.toString(),
      propertyAttest: listing.propertyAttest.toString(),
      address: Buffer.from(listing.address).toString('utf8').replace(/\0/g, ''),
      buildingArea: listing.buildingArea,
      rent: listing.rent.toString(),
      deposit: listing.deposit.toString(),
      status: listing.status,
      currentTenant: listing.currentTenant,
      createdAt: listing.createdAt.toNumber(),
      metadata,
      ipfsHash
    };

    cache.set(cacheKey, result, 300);
    res.json(result);
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// 切換房源狀態 (上架/下架)
router.post('/:publicKey/toggle', requirePropertyCredential, async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { publicKey } = req.params;
    const userPublicKey = new PublicKey(req.user!.publicKey);
    const listingPubkey = new PublicKey(publicKey);

    // 檢查擁有者
    const listing = await program.account.listing.fetch(listingPubkey);
    if (!listing.owner.equals(userPublicKey)) {
      throw new ApiError(403, 'Not the owner of this listing');
    }

    const tx = await program.methods
      .toggleListing()
      .accountsStrict({
        listing: listingPubkey,
        owner: userPublicKey,
      })
      .transaction();

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    // 清除緩存
    cache.del(`listing:${publicKey}`);
    cache.flushAll(); // 清除列表緩存

    res.json({
      success: true,
      transaction: serialized.toString('base64'),
      newStatus: listing.status === 0 ? 2 : 0 // 0->2 或 2->0
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

export { router as listingRouter };
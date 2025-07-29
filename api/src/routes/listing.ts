import { Router } from 'express';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { program, derivePDAs, apiSignerWallet } from '../config/solana';
import { CredentialService } from '../services/credential';
import { StorageService } from '../services/storage';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest, requirePropertyCredential } from '../middleware/auth';
import { cache } from '../index';
import { BN } from '@coral-xyz/anchor';
import multer from 'multer';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10 // 最多10張照片
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// 暫存房源照片
router.post('/upload-images', requirePropertyCredential, upload.array('images', 10), async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      throw new ApiError(400, 'No images provided');
    }

    const uploadPromises = files.map(async (file, index) => {
      const shortPubkey = req.user!.publicKey.slice(0, 4) + req.user!.publicKey.slice(-4);
      const filename = `img_${shortPubkey}_${Date.now()}_${index}.${file.mimetype.split('/')[1]}`;
      
      const result = await StorageService.uploadFile(
        file.buffer,
        filename,
        file.mimetype
      );

      return {
        id: result.ipfsHash,
        filename,
        size: file.size,
        mimetype: file.mimetype,
        ipfsHash: result.ipfsHash,
        gatewayUrl: result.gatewayUrl,
        uploadedAt: Date.now()
      };
    });

    const uploadedImages = await Promise.all(uploadPromises);

    // 緩存暫存的圖片資訊（30分鐘過期）
    const cacheKey = `tempImages:${req.user!.publicKey}:${Date.now()}`;
    cache.set(cacheKey, uploadedImages, 1800);

    res.json({
      success: true,
      images: uploadedImages,
      cacheKey
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// 刪除暫存照片
router.delete('/image/:imageId', requirePropertyCredential, async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { imageId } = req.params;
    
    if (!imageId) {
      throw new ApiError(400, 'Image ID is required');
    }

    const unpinned = await StorageService.unpin(imageId);
    
    const keys = cache.keys();
    keys.forEach(key => {
      if (key.startsWith(`tempImages:${req.user!.publicKey}:`)) {
        const images = cache.get(key) as any[];
        if (images && Array.isArray(images)) {
          const filteredImages = images.filter(img => img.id !== imageId);
          if (filteredImages.length !== images.length) {
            cache.set(key, filteredImages);
          }
        }
      }
    });

    res.json({
      success: true,
      unpinned,
      message: unpinned ? 'Image deleted successfully' : 'Image removed from cache'
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// 獲取用戶暫存的照片
router.get('/temp-images', requirePropertyCredential, async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const keys = cache.keys();
    const userTempImages: any[] = [];

    keys.forEach(key => {
      if (key.startsWith(`tempImages:${req.user!.publicKey}:`)) {
        const images = cache.get(key);
        if (images && Array.isArray(images)) {
          userTempImages.push(...images);
        }
      }
    });

    // 按上傳時間排序
    userTempImages.sort((a, b) => b.uploadedAt - a.uploadedAt);

    res.json({
      success: true,
      images: userTempImages,
      count: userTempImages.length
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// 創建房源
router.post('/create', requirePropertyCredential, async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { propertyAttest, credentialId, rent, deposit, metadata, imageIds } = req.body;
    const userPublicKey = new PublicKey(req.user!.publicKey);

    // 驗證參數
    if (!propertyAttest || !credentialId || !rent || !deposit || !metadata) {
      throw new ApiError(400, 'Missing required fields');
    }

    // 驗證押金範圍 (1-3個月租金)
    if (deposit < rent || deposit > rent * 3) {
      throw new ApiError(400, 'Deposit must be between 1-3 months rent');
    }

    // 獲取緩存的揭露結果
    console.log('Checking disclosure cache:', {
      publicKey: req.user!.publicKey,
      credentialId,
      cacheKey: `disclosure:${req.user!.publicKey}:${credentialId}`
    });
    
    const disclosure = CredentialService.getCachedDisclosure(req.user!.publicKey, credentialId);
    console.log('Disclosure result:', disclosure);
    
    if (!disclosure || !disclosure.success) {
      // 列出所有相關的緩存 key
      const keys = cache.keys();
      const relevantKeys = keys.filter(k => k.startsWith(`disclosure:${req.user!.publicKey}:`));
      console.log('Available disclosure cache keys:', relevantKeys);
      
      throw new ApiError(400, 'Please complete property disclosure first');
    }

    // 驗證揭露資料
    if (!disclosure.data?.address || !disclosure.data?.building_area || disclosure.data?.use !== '住宅') {
      throw new ApiError(400, 'Invalid disclosure data');
    }

    // 處理照片
    let processedImages: string[] = [];
    if (imageIds && Array.isArray(imageIds) && imageIds.length > 0) {
      // 從緩存中獲取對應的圖片資訊
      const keys = cache.keys();
      const allTempImages: any[] = [];
      
      keys.forEach(key => {
        if (key.startsWith(`tempImages:${req.user!.publicKey}:`)) {
          const images = cache.get(key);
          if (images && Array.isArray(images)) {
            allTempImages.push(...images);
          }
        }
      });

      // 篩選用戶選擇的圖片
      processedImages = imageIds
        .map(id => allTempImages.find(img => img.id === id)?.ipfsHash)
        .filter(Boolean);
    }

    // 構建最終的metadata
    const finalMetadata = {
      ...metadata,
      media: {
        images: processedImages,
        primary_image: 0
      }
    };

    // 上傳 metadata 到 IPFS
    const ipfsResult = await StorageService.uploadJSON(finalMetadata, 'listing', req.user!.publicKey);
    
    // 準備鏈上資料
    const addressBytes = Buffer.alloc(64);
    addressBytes.write(disclosure.data.address);
    
    const propertyAttestPubkey = new PublicKey(propertyAttest);
    const [listingPda] = derivePDAs.listing(propertyAttestPubkey);
    const [configPda] = derivePDAs.config();

    // 創建交易
    const tx = await program.methods
      .createListing(
        Array.from(addressBytes),
        disclosure.data.building_area,
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

    // 設置 recentBlockhash
    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;

    // API 簽名交易
    tx.partialSign(apiSignerWallet.payer);

    // 序列化交易供前端簽名
    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    // 清除用戶的暫存圖片緩存
    const keys = cache.keys();
    keys.forEach(key => {
      if (key.startsWith(`tempImages:${req.user!.publicKey}:`)) {
        cache.del(key);
      }
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64'),
      listing: listingPda.toString(),
      ipfsHash: ipfsResult.ipfsHash,
      gatewayUrl: ipfsResult.gatewayUrl,
      disclosedData: {
        address: disclosure.data.address,
        buildingArea: disclosure.data.building_area,
        use: disclosure.data.use
      }
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

    cache.set(cacheKey, result, 300);
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

    // 設置 recentBlockhash
    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    // 清除緩存
    cache.del(`listing:${publicKey}`);
    cache.flushAll();

    res.json({
      success: true,
      transaction: serialized.toString('base64'),
      newStatus: listing.status === 0 ? 2 : 0
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

export { router as listingRouter };
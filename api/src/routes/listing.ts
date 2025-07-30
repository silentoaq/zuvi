import { Router } from 'express';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { program, derivePDAs, apiSignerWallet } from '../config/solana';
import { CredentialService } from '../services/credential';
import { StorageService } from '../services/storage';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest, requirePropertyCredential, authenticateToken } from '../middleware/auth';
import { cache } from '../index';
import { BN } from '@coral-xyz/anchor';
import multer from 'multer';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// 暫存房源照片 (需要認證)
router.post('/upload-images', authenticateToken, requirePropertyCredential, upload.array('images', 10), async (req: AuthRequest, res, next): Promise<void> => {
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

// 獲取用戶暫存的照片 (需要認證)
router.get('/temp-images', authenticateToken, requirePropertyCredential, async (req: AuthRequest, res, next): Promise<void> => {
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

// 刪除暫存照片 (需要認證)
router.delete('/image/:imageId', authenticateToken, requirePropertyCredential, async (req: AuthRequest, res, next): Promise<void> => {
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

// 創建房源 (需要認證)
router.post('/create', authenticateToken, requirePropertyCredential, async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { propertyAttest, credentialId, rent, deposit, metadata, imageIds } = req.body;
    const userPublicKey = new PublicKey(req.user!.publicKey);

    if (!propertyAttest || !credentialId || !rent || !deposit || !metadata) {
      throw new ApiError(400, 'Missing required fields');
    }

    if (deposit < rent || deposit > rent * 3) {
      throw new ApiError(400, 'Deposit must be between 1-3 months rent');
    }

    const disclosure = CredentialService.getCachedDisclosure(req.user!.publicKey, credentialId);
  
    if (!disclosure || !disclosure.success) { 
      throw new ApiError(400, 'Please complete property disclosure first');
    }

    if (!disclosure.data?.address || !disclosure.data?.building_area || disclosure.data?.use !== '住宅') {
      throw new ApiError(400, 'Invalid disclosure data');
    }

    let processedImages: string[] = [];
    if (imageIds && Array.isArray(imageIds) && imageIds.length > 0) {
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

      processedImages = imageIds
        .map(id => allTempImages.find(img => img.id === id)?.ipfsHash)
        .filter(Boolean);
    }

    const finalMetadata = {
      ...metadata,
      media: {
        images: processedImages,
        primary_image: 0
      }
    };

    const ipfsResult = await StorageService.uploadJSON(finalMetadata, 'listing', req.user!.publicKey);
    
    const addressBytes = Buffer.alloc(64);
    addressBytes.write(disclosure.data.address);
    
    const propertyAttestPubkey = new PublicKey(propertyAttest);
    const [listingPda] = derivePDAs.listing(propertyAttestPubkey);
    const [configPda] = derivePDAs.config();

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

    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;
    tx.partialSign(apiSignerWallet.payer);

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

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

// 切換房源狀態 (需要認證)
router.post('/:publicKey/toggle', authenticateToken, requirePropertyCredential, async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { publicKey } = req.params;
    const userPublicKey = new PublicKey(req.user!.publicKey);
    const listingPubkey = new PublicKey(publicKey);

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

    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

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

// 查詢單一房源 (公開)
router.get('/:publicKey', async (req, res, next): Promise<void> => {
  try {
    const { publicKey } = req.params;
    
    if (!publicKey || publicKey.length < 32) {
      throw new ApiError(400, 'Invalid public key format');
    }

    const cacheKey = `listing:${publicKey}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    let listingPubkey: PublicKey;
    try {
      listingPubkey = new PublicKey(publicKey);
    } catch {
      throw new ApiError(400, 'Invalid public key format');
    }

    let listing;
    try {
      listing = await program.account.listing.fetch(listingPubkey);
    } catch {
      throw new ApiError(404, 'Listing not found');
    }

    let metadata = null;
    let ipfsHash = null;
    
    try {
      ipfsHash = StorageService.bytesToIpfsHash(listing.metadataUri);
      metadata = await StorageService.getJSON(ipfsHash);
    } catch (error) {
      console.error('Error loading metadata:', error);
    }

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

// 查詢房源列表 (公開)
router.get('/', async (req, res, next): Promise<void> => {
  try {
    const { status, owner, page = 1, limit = 20 } = req.query;
    
    const cacheKey = `listings:${status}:${owner}:${page}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const listings = await program.account.listing.all();

    let filtered = listings;
    if (status !== undefined && status !== 'all') {
      filtered = filtered.filter(l => l.account.status === Number(status));
    }
    if (owner) {
      filtered = filtered.filter(l => l.account.owner.toString() === owner);
    }

    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginated = filtered.slice(startIndex, endIndex);

    const enriched = await Promise.all(
      paginated.map(async (listing) => {
        try {
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
        } catch (error) {
          console.error('Error processing listing:', error);
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
            metadata: null,
            ipfsHash: null
          };
        }
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

export { router as listingRouter };
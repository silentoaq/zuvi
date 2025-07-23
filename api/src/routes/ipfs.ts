import express from 'express';
import multer from 'multer';
import { verifyWallet, AuthRequest } from '../middleware/auth.ts';
import { uploadFile, uploadJSON, getFromIPFS, UploadResult } from '../services/ipfs.ts';
import { createLogger } from '../utils/logger.ts';

const router = express.Router();
const logger = createLogger();

// 設定 multer 處理檔案上傳
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10
  },
  fileFilter: (req, file, cb) => {
    // 只允許圖片
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
      return;
    }
    cb(null, true);
  }
});

// 上傳單張圖片
router.post('/upload-image', verifyWallet, upload.single('image'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    res.json(result);
  } catch (error) {
    logger.error('Image upload failed:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// 上傳多張圖片
router.post('/upload-images', verifyWallet, upload.array('images', 10), async (req: AuthRequest, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // 並行上傳所有圖片
    const uploadPromises = files.map(file => 
      uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype
      )
    );

    const results = await Promise.all(uploadPromises);
    
    res.json({
      count: results.length,
      images: results
    });
  } catch (error) {
    logger.error('Multiple images upload failed:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

// 上傳房源詳情 JSON
router.post('/upload-property-details', verifyWallet, async (req: AuthRequest, res) => {
  try {
    const { 
      description, 
      images, 
      features,
      amenities,
      rules,
      location
    } = req.body;

    logger.info('Uploading property details:', {
      hasDescription: !!description,
      imageCount: images?.length || 0,
      wallet: req.wallet?.address
    });

    if (!description || !images || images.length === 0) {
      return res.status(400).json({ 
        error: 'Description and at least one image are required' 
      });
    }

    // 構建房源詳情物件
    const propertyDetails = {
      description,
      images, // IPFS hashes array
      features: features || [],
      amenities: amenities || [],
      rules: rules || [],
      location: location || {},
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.wallet!.did
    };

    const result = await uploadJSON(propertyDetails);
    
    logger.info('Property details uploaded successfully:', {
      ipfsHash: result.ipfsHash,
      size: result.size
    });
    
    res.json(result);
  } catch (error) {
    logger.error('Property details upload failed:', error);
    res.status(500).json({ 
      error: 'Failed to upload property details',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 獲取 IPFS 內容
router.get('/get/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    
    if (!hash) {
      return res.status(400).json({ error: 'Hash is required' });
    }

    const data = await getFromIPFS(hash);
    
    res.json(data);
  } catch (error) {
    logger.error('IPFS fetch failed:', error);
    res.status(500).json({ error: 'Failed to fetch from IPFS' });
  }
});

export default router;
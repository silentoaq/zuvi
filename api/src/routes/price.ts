import express from 'express';
import { createLogger } from '../utils/logger.ts';

const router = express.Router();
const logger = createLogger();

// SOL 價格快取
let priceCache: {
  price: number;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 分鐘

// 取得 SOL 價格
router.get('/sol', async (req, res) => {
  try {
    // 檢查快取
    if (priceCache && Date.now() - priceCache.timestamp < CACHE_DURATION) {
      return res.json({ 
        price: priceCache.price,
        cached: true 
      });
    }

    // 呼叫價格 API
    const response = await fetch(process.env.SOL_PRICE_API!);
    if (!response.ok) {
      throw new Error('Failed to fetch SOL price');
    }

    const data = await response.json();
    
    // 更新快取
    priceCache = {
      price: data.Price,
      timestamp: Date.now()
    };

    res.json({ 
      price: data.Price,
      cached: false 
    });
  } catch (error) {
    logger.error('Failed to fetch SOL price:', error);
    res.status(503).json({ 
      error: 'SOL price service unavailable' 
    });
  }
});

// 計算 SOL 手續費的 USDC 價值
router.post('/calculate-fee', async (req, res) => {
  try {
    const { lamports } = req.body;
    
    if (!lamports || typeof lamports !== 'number') {
      return res.status(400).json({ 
        error: 'Invalid lamports amount' 
      });
    }

    // 取得 SOL 價格
    let solPrice: number;
    
    if (priceCache && Date.now() - priceCache.timestamp < CACHE_DURATION) {
      solPrice = priceCache.price;
    } else {
      try {
        const response = await fetch(process.env.SOL_PRICE_API!);
        if (!response.ok) {
          throw new Error('Price API unavailable');
        }
        
        const data = await response.json();
        solPrice = data.Price;
        
        priceCache = {
          price: solPrice,
          timestamp: Date.now()
        };
      } catch (e) {
        logger.error('Failed to fetch SOL price:', e);
        return res.status(503).json({ 
          error: 'Price service unavailable' 
        });
      }
    }

    // 計算 USDC 金額
    const sol = lamports / 1_000_000_000;
    const usdcAmount = sol * solPrice;
    const usdcMicroAmount = Math.ceil(usdcAmount * 1_000_000); // USDC 6 位小數

    res.json({
      lamports,
      sol,
      solPrice,
      usdcAmount,
      usdcMicroAmount
    });
  } catch (error) {
    logger.error('Failed to calculate fee:', error);
    res.status(500).json({ 
      error: 'Failed to calculate fee' 
    });
  }
});

export default router;
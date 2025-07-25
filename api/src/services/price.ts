import { createLogger } from '../utils/logger.ts';

const logger = createLogger();

// 價格快取（5分鐘）
let priceCache: {
  price: number;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000;

export async function getSolPrice(): Promise<number> {
  try {
    // 檢查快取
    if (priceCache && Date.now() - priceCache.timestamp < CACHE_DURATION) {
      return priceCache.price;
    }

    // 從 DIA 取得 SOL 價格
    const response = await fetch(process.env.SOL_PRICE_API!);
    
    if (!response.ok) {
      throw new Error('Failed to fetch SOL price');
    }

    const data = await response.json();
    const price = parseFloat(data.Price);

    // 更新快取
    priceCache = {
      price,
      timestamp: Date.now()
    };

    logger.info(`SOL price updated: $${price}`);
    return price;
    
  } catch (error) {
    logger.error('Failed to get SOL price:', error);
    
    // 如果失敗，使用預設值
    return 150;
  }
}
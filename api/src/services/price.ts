import { createLogger } from '../utils/logger.ts';

const logger = createLogger();

let priceCache: {
  price: number;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000;

export async function getSolPrice(): Promise<number> {
  try {
    if (priceCache && Date.now() - priceCache.timestamp < CACHE_DURATION) {
      return priceCache.price;
    }

    const response = await fetch(process.env.SOL_PRICE_API!);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch SOL price: ${response.status}`);
    }

    const data = await response.json();
    const price = parseFloat(data.Price);
    
    if (isNaN(price) || price <= 0) {
      throw new Error('Invalid price data received');
    }

    priceCache = {
      price,
      timestamp: Date.now()
    };

    logger.info(`SOL price updated: ${price}`);
    return price;
    
  } catch (error) {
    logger.error('Failed to get SOL price:', error);
    throw new Error('Unable to fetch current SOL price');
  }
}
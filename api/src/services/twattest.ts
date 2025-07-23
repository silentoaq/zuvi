import { createTwattestSDK } from '@twattest/sdk';
import { createLogger } from '../utils/logger.ts';

const logger = createLogger();

let twattestInstance: ReturnType<typeof createTwattestSDK> | null = null;

export function getTwattestSDK() {
  if (!twattestInstance) {
    const baseUrl = process.env.TWATTEST_API_URL;
    const apiKey = process.env.TWATTEST_API_KEY;
    
    if (!baseUrl || !apiKey) {
      logger.error('Missing Twattest configuration', { baseUrl, hasApiKey: !!apiKey });
      throw new Error('Twattest SDK not configured. Check TWATTEST_API_URL and TWATTEST_API_KEY');
    }
    
    twattestInstance = createTwattestSDK({
      baseUrl,
      apiKey
    });
    
    logger.info('Twattest SDK initialized', { baseUrl });
  }
  
  return twattestInstance;
}
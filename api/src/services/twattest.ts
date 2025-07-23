import { createTwattestSDK, TwattestSDK } from '@twattest/sdk';
import { createLogger } from '../utils/logger.ts';

const logger = createLogger();
let sdkInstance: TwattestSDK | null = null;

export function getTwattestSDK(): TwattestSDK {
  if (!sdkInstance) {
    logger.info('Initializing twattest SDK...');
    sdkInstance = createTwattestSDK({
      baseUrl: process.env.TWATTEST_API_URL!,
      apiKey: process.env.TWATTEST_API_KEY!
    });
    logger.info('twattest SDK initialized successfully');
  }
  return sdkInstance;
}
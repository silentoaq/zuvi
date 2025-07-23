import { PinataSDK } from 'pinata-web3';
import { createLogger } from '../utils/logger.ts';

const logger = createLogger();

let pinataInstance: PinataSDK | null = null;

export function getPinataSDK(): PinataSDK {
  if (!pinataInstance) {
    const jwt = process.env.PINATA_JWT;
    const gateway = process.env.PINATA_GATEWAY;
    
    if (!jwt || !gateway) {
      logger.error('Pinata environment variables missing', {
        hasJwt: !!jwt,
        hasGateway: !!gateway
      });
      throw new Error('Pinata configuration missing');
    }
    
    logger.info('Initializing Pinata SDK...');
    pinataInstance = new PinataSDK({
      pinataJwt: jwt,
      pinataGateway: gateway
    });
    logger.info('Pinata SDK initialized');
  }
  return pinataInstance;
}

export interface UploadResult {
  ipfsHash: string;
  gatewayUrl: string;
  size: number;
}

// 上傳單個檔案
export async function uploadFile(
  file: Buffer,
  filename: string,
  contentType: string
): Promise<UploadResult> {
  try {
    const pinata = getPinataSDK();
    
    // 創建 File 物件
    const blob = new Blob([file], { type: contentType });
    const fileObj = new File([blob], filename, { type: contentType });
    
    // 上傳到 IPFS
    const result = await pinata.upload.file(fileObj);
    
    logger.info('File uploaded to IPFS:', {
      filename,
      ipfsHash: result.IpfsHash,
      size: result.PinSize
    });
    
    return {
      ipfsHash: result.IpfsHash,
      gatewayUrl: `https://${process.env.PINATA_GATEWAY}/ipfs/${result.IpfsHash}`,
      size: result.PinSize
    };
  } catch (error) {
    logger.error('IPFS upload failed:', error);
    throw new Error('Failed to upload file to IPFS');
  }
}

// 上傳 JSON 資料
export async function uploadJSON(data: any): Promise<UploadResult> {
  try {
    const pinata = getPinataSDK();
    
    const result = await pinata.upload.json(data);
    
    logger.info('JSON uploaded to IPFS:', {
      ipfsHash: result.IpfsHash,
      size: result.PinSize
    });
    
    return {
      ipfsHash: result.IpfsHash,
      gatewayUrl: `https://${process.env.PINATA_GATEWAY}/ipfs/${result.IpfsHash}`,
      size: result.PinSize
    };
  } catch (error) {
    logger.error('IPFS JSON upload failed:', error);
    throw new Error('Failed to upload JSON to IPFS');
  }
}

// 從 IPFS 獲取內容
export async function getFromIPFS(ipfsHash: string): Promise<any> {
  try {
    const pinata = getPinataSDK();
    const data = await pinata.gateways.get(ipfsHash);
    return data;
  } catch (error) {
    logger.error('IPFS fetch failed:', error);
    throw new Error('Failed to fetch from IPFS');
  }
}
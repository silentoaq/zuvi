import { PinataSDK } from 'pinata';
import { cache } from '../index';

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!
});

export class StorageService {
  // 上傳 JSON 到 IPFS
  static async uploadJSON(data: any, name: string) {
    try {
      // 將 JSON 轉為 Blob 再轉為 File
      const jsonString = JSON.stringify(data);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], `${name}.json`, { type: 'application/json' });
      
      const result = await (pinata as any).upload.file(file);
      
      return {
        ipfsHash: result.IpfsHash || result.cid,
        pinSize: result.PinSize || result.size,
        gatewayUrl: `${process.env.PINATA_GATEWAY}/ipfs/${result.IpfsHash || result.cid}`
      };
    } catch (error) {
      throw new Error(`Failed to upload to IPFS: ${error}`);
    }
  }

  // 從 IPFS 獲取資料
  static async getJSON(ipfsHash: string) {
    const cacheKey = `ipfs:${ipfsHash}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const url = `${process.env.PINATA_GATEWAY}/ipfs/${ipfsHash}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
      }
      
      const data = await response.json();
      cache.set(cacheKey, data, 7200); // 緩存2小時
      return data;
    } catch (error) {
      throw new Error(`Failed to get from IPFS: ${error}`);
    }
  }

  // 上傳檔案到 IPFS
  static async uploadFile(file: Buffer, filename: string, mimetype: string) {
    try {
      const blob = new Blob([file], { type: mimetype });
      const fileToUpload = new File([blob], filename, { type: mimetype });
      
      const result = await (pinata as any).upload.file(fileToUpload);
      
      return {
        ipfsHash: result.IpfsHash || result.cid,
        pinSize: result.PinSize || result.size,
        gatewayUrl: `${process.env.PINATA_GATEWAY}/ipfs/${result.IpfsHash || result.cid}`
      };
    } catch (error) {
      throw new Error(`Failed to upload file to IPFS: ${error}`);
    }
  }

  // 刪除 IPFS 上的內容
  static async unpin(ipfsHash: string) {
    try {
      await (pinata as any).unpin(ipfsHash);
      cache.del(`ipfs:${ipfsHash}`);
      return true;
    } catch (error) {
      console.error(`Failed to unpin ${ipfsHash}:`, error);
      return false;
    }
  }

  // 將 IPFS Hash 轉換為固定長度的 bytes
  static ipfsHashToBytes(ipfsHash: string): number[] {
    const bytes = Buffer.from(ipfsHash, 'utf8');
    const fixedBytes = new Uint8Array(46);
    fixedBytes.set(bytes.slice(0, 46));
    return Array.from(fixedBytes);
  }

  // 從 bytes 轉換回 IPFS Hash
  static bytesToIpfsHash(bytes: number[]): string {
    const buffer = Buffer.from(bytes);
    const nullIndex = buffer.indexOf(0);
    const actualBytes = nullIndex === -1 ? buffer : buffer.slice(0, nullIndex);
    return actualBytes.toString('utf8');
  }
}
import { TwattestSDK } from '@twattest/sdk';
import { cache } from '../index';

const sdk = new TwattestSDK({
  baseUrl: process.env.TWATTEST_BASE_URL!,
  apiKey: process.env.TWATTEST_API_KEY!,
  timeout: 30000
});

// 定義返回類型
interface PropertyCredentialResult {
  verified: boolean;
  data: any;
  attestations: Array<{
    address: string;
    data: {
      merkleRoot: string;
      credentialReference: string;
    };
    expiry: number;
  }>;
}

interface CitizenCredentialResult {
  verified: boolean;
  data: any;
  attestation: {
    exists: boolean;
    address: string;
    data: {
      merkleRoot: string;
      credentialReference: string;
    } | null;
    expiry: number | null;
  };
}

export class CredentialService {
  // 驗證產權憑證並取得揭露資料
  static async verifyPropertyCredential(
    holderDid: string,
    requiredFields: string[]
  ): Promise<PropertyCredentialResult> {
    const cacheKey = `property:${holderDid}:${requiredFields.join(',')}`;
    const cached = cache.get<PropertyCredentialResult>(cacheKey);
    if (cached) return cached;

    try {
      // 檢查憑證狀態
      const status = await sdk.getAttestationStatus(holderDid);
      
      if (!status.twland?.exists || status.twland.count === 0) {
        throw new Error('No property credential found');
      }

      // 如果不需要揭露任何欄位，只返回驗證結果
      if (requiredFields.length === 0) {
        const result = {
          verified: true,
          data: {},
          attestations: status.twland.attestations
        };
        cache.set(cacheKey, result, 3600);
        return result;
      }

      // 創建揭露請求
      const request = await sdk.createDisclosureRequest({
        holderDid,
        credentialType: 'PropertyCredential',
        requiredFields,
        purpose: '租房平台房源刊登驗證'
      });

      // 等待揭露完成
      const disclosure = await sdk.waitForDisclosure(request.requestId, {
        timeout: 300000,
        pollInterval: 2000
      });

      if (disclosure.status !== 'completed') {
        throw new Error('Disclosure not completed');
      }

      const result = {
        verified: true,
        data: disclosure.disclosedData,
        attestations: status.twland.attestations
      };

      cache.set(cacheKey, result, 3600); // 緩存1小時
      return result;
    } catch (error) {
      throw new Error(`Property credential verification failed: ${error}`);
    }
  }

  // 驗證自然人憑證
  static async verifyCitizenCredential(
    holderDid: string,
    requiredFields: string[]
  ): Promise<CitizenCredentialResult> {
    const cacheKey = `citizen:${holderDid}:${requiredFields.join(',')}`;
    const cached = cache.get<CitizenCredentialResult>(cacheKey);
    if (cached) return cached;

    try {
      // 檢查憑證狀態
      const status = await sdk.getAttestationStatus(holderDid);
      
      if (!status.twfido?.exists) {
        throw new Error('No citizen credential found');
      }

      // 如果不需要揭露任何欄位，只返回驗證結果
      if (requiredFields.length === 0) {
        const result = {
          verified: true,
          data: {},
          attestation: status.twfido
        };
        cache.set(cacheKey, result, 3600);
        return result;
      }

      // 創建揭露請求
      const request = await sdk.createDisclosureRequest({
        holderDid,
        credentialType: 'CitizenCredential',
        requiredFields,
        purpose: '租房平台身份驗證'
      });

      // 等待揭露完成
      const disclosure = await sdk.waitForDisclosure(request.requestId, {
        timeout: 300000,
        pollInterval: 2000
      });

      if (disclosure.status !== 'completed') {
        throw new Error('Disclosure not completed');
      }

      const result = {
        verified: true,
        data: disclosure.disclosedData,
        attestation: status.twfido
      };

      cache.set(cacheKey, result, 3600); // 緩存1小時
      return result;
    } catch (error) {
      throw new Error(`Citizen credential verification failed: ${error}`);
    }
  }

  // 生成 QR Code URL
  static generateQRCode(vpRequestUri: string) {
    return sdk.generateQRCodeUrl(vpRequestUri);
  }
}
import { createTwattestSDK, TwattestSDK } from '@twattest/sdk';
import { cache } from '../index';

let sdk: TwattestSDK | null = null;

function getSDK(): TwattestSDK {
  if (!sdk) {
    sdk = createTwattestSDK({
      baseUrl: process.env.TWATTEST_BASE_URL!,
      apiKey: process.env.TWATTEST_API_KEY!
    });
  }
  return sdk;
}

export interface AttestationData {
  merkleRoot: string;
  credentialReference: string;
}

export interface PropertyAttestation {
  address: string;
  data: AttestationData;
  expiry: number;
}

export interface CitizenAttestation {
  exists: boolean;
  address: string;
  data: AttestationData | null;
  expiry: number | null;
}

export interface CredentialStatus {
  twfido?: CitizenAttestation;
  twland?: {
    exists: boolean;
    attestations: PropertyAttestation[];
    count: number;
  };
}

export interface DisclosureResult {
  success: boolean;
  data?: any;
  credentialId?: string;
  error?: string;
}

export class CredentialService {
  // 獲取完整憑證狀態
  static async getCredentialStatus(publicKey: string): Promise<CredentialStatus> {
    const did = `did:pkh:sol:${publicKey}`;
    const cacheKey = `credentialStatus:${did}`;
    const cached = cache.get<CredentialStatus>(cacheKey);
    if (cached) return cached;

    try {
      const status = await getSDK().getAttestationStatus(did);
      cache.set(cacheKey, status, 3600);
      return status;
    } catch (error) {
      throw new Error(`Failed to get credential status: ${error}`);
    }
  }

  // 創建產權憑證揭露請求
  static async createPropertyDisclosure(
    publicKey: string,
    credentialId: string
  ): Promise<{ vpRequestUri: string; requestId: string }> {
    try {
      const did = `did:pkh:sol:${publicKey}`;
      const request = await getSDK().createDisclosureRequest({
        holderDid: did,
        credentialType: 'PropertyCredential',
        credentialId,
        requiredFields: ['address', 'building_area', 'use'],
        purpose: '租房平台房源刊登驗證'
      });

      return {
        vpRequestUri: request.vpRequestUri,
        requestId: request.requestId
      };
    } catch (error) {
      throw new Error(`Failed to create property disclosure: ${error}`);
    }
  }

  // 檢查揭露狀態（不等待）
  static async getDisclosureStatus(requestId: string): Promise<{
    status: 'pending' | 'completed' | 'expired';
    disclosedData?: any;
    error?: string;
  }> {
    try {
      const status = await getSDK().getDisclosureStatus(requestId);
      return status;
    } catch (error) {
      return {
        status: 'pending',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }



  // 驗證揭露資料並緩存
  static async validateDisclosureData(
    publicKey: string,
    credentialId: string,
    disclosedData: any
  ): Promise<DisclosureResult> {
    try {
      // 驗證揭露的用途必須是住宅
      if (disclosedData?.use !== '住宅') {
        return { success: false, error: 'Property must be residential' };
      }

      // 驗證必要欄位
      if (!disclosedData?.address || !disclosedData?.building_area) {
        return { success: false, error: 'Missing required fields: address or building_area' };
      }

      const result = {
        success: true,
        data: disclosedData,
        credentialId
      };

      // 緩存揭露結果
      const cacheKey = `disclosure:${publicKey}:${credentialId}`;
      console.log('Setting cache with key:', cacheKey);
      cache.set(cacheKey, result, 600);

      return result;
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown validation error' 
      };
    }
  }

  // 獲取緩存的揭露結果
  static getCachedDisclosure(publicKey: string, credentialId: string): DisclosureResult | null {
    const cacheKey = `disclosure:${publicKey}:${credentialId}`;
    return cache.get<DisclosureResult>(cacheKey) || null;
  }

  // 生成 QR Code URL
  static generateQRCode(vpRequestUri: string) {
    return getSDK().generateQRCodeUrl(vpRequestUri);
  }
}
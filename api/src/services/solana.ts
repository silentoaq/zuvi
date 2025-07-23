import { Transaction, VersionedTransaction } from '@solana/web3.js';

export interface PrepareListingParams {
  propertyId: string;
  ownerAttestation: string;
  monthlyRent: number;
  depositMonths: number;
  propertyDetailsHash: string;
}

export interface PrepareListingResponse {
  transaction: string;
  lastValidBlockHeight: number;
  breakdown: {
    listingFee: number;
    txFeeInUsdc: number;
    totalUsdc: number;
  };
  listingAddress: string;
}

export interface ExecuteTransactionResponse {
  signature: string;
  confirmed: boolean;
}

export class SolanaService {
  // 準備發布房源交易
  static async prepareListingTransaction(
    params: PrepareListingParams,
    authToken: string
  ): Promise<PrepareListingResponse> {
    const response = await fetch('/api/listing/prepare', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to prepare transaction');
    }

    return response.json();
  }

  // 執行已簽名交易
  static async executeTransaction(
    signedTransaction: string,
    lastValidBlockHeight: number,
    authToken: string
  ): Promise<ExecuteTransactionResponse> {
    const response = await fetch('/api/listing/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        signedTransaction,
        lastValidBlockHeight
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to execute transaction');
    }

    return response.json();
  }

  // 反序列化交易
  static deserializeTransaction(transactionBase64: string): Transaction {
    const buffer = Buffer.from(transactionBase64, 'base64');
    return Transaction.from(buffer);
  }

  // 序列化已簽名交易
  static serializeSignedTransaction(transaction: Transaction): string {
    return transaction.serialize().toString('base64');
  }
}
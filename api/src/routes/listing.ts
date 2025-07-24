import express from 'express';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import BN from 'bn.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import IDL from '../types/zuvi.json' assert { type: 'json' };
import { verifyWallet, AuthRequest } from '../middleware/auth.ts';
import { requireProperty } from '../middleware/attestation.ts';
import { createLogger } from '../utils/logger.ts';
import type { Zuvi } from '../types/zuvi.ts';

const router = express.Router();
const logger = createLogger();

// 發布房源交易準備
router.post('/prepare', verifyWallet, requireProperty, async (req: AuthRequest, res) => {
  try {
    const {
      propertyId,
      ownerAttestation,
      monthlyRent,
      depositMonths,
      propertyDetailsHash
    } = req.body;

    if (!propertyId || !ownerAttestation || !monthlyRent || !depositMonths || !propertyDetailsHash) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const connection = new Connection(`https://${process.env.RPC_ROOT}`);
    const programId = new PublicKey(process.env.ZUVI_PROGRAM_ID!);
    
    const provider = new AnchorProvider(
      connection,
      {} as any,
      { commitment: 'confirmed' }
    );
    
    const program = new Program<Zuvi>(IDL as any, provider);
    
    const owner = new PublicKey(req.wallet!.address);
    const usdcMint = new PublicKey(process.env.USDC_MINT!);
    
    // PDA
    const [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );
    
    const [listingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('listing'), Buffer.from(propertyId)],
      programId
    );
    
    const platform = await program.account.platform.fetch(platformPda);
    
    // Token 帳戶
    const ownerUsdcAccount = await getAssociatedTokenAddress(
      usdcMint,
      owner
    );
    
    const platformUsdcAccount = await getAssociatedTokenAddress(
      usdcMint,
      platformPda,
      true
    );
    
    // 費用計算
    const listingFee = platform.listingFee.toNumber();
    const solPrice = await getSolPrice();
    
    const estimatedTxFee = 10000; // lamports
    const txFeeInUsdc = Math.ceil((estimatedTxFee / 1_000_000_000) * solPrice * 1_000_000);
    
    const totalUsdc = listingFee + txFeeInUsdc;
    
    // 建立指令
    const instruction = await program.methods
      .listProperty(
        propertyId,
        ownerAttestation,
        new BN(monthlyRent),
        depositMonths,
        propertyDetailsHash
      )
      .accountsPartial({
        platform: platformPda,
        listing: listingPda,
        owner,
        ownerUsdcAccount,
        platformUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        clock: new PublicKey('SysvarC1ock11111111111111111111111111111111')
      })
      .instruction();
    
    // 交易組裝
    const transaction = new Transaction();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = owner;
    transaction.add(instruction);
    
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false
    }).toString('base64');
    
    res.json({
      transaction: serializedTransaction,
      lastValidBlockHeight,
      breakdown: {
        listingFee: listingFee / 1_000_000,
        txFeeInUsdc: txFeeInUsdc / 1_000_000,
        totalUsdc: totalUsdc / 1_000_000
      },
      listingAddress: listingPda.toString()
    });
  } catch (error) {
    logger.error('Failed to prepare listing transaction:', error);
    res.status(500).json({ error: 'Failed to prepare transaction' });
  }
});

// 執行已簽名交易
router.post('/execute', verifyWallet, async (req: AuthRequest, res) => {
  try {
    const { signedTransaction, lastValidBlockHeight } = req.body;
    
    if (!signedTransaction || !lastValidBlockHeight) {
      return res.status(400).json({ error: 'Missing transaction data' });
    }
    
    const connection = new Connection(`https://${process.env.RPC_ROOT}`);
    
    const tx = Transaction.from(Buffer.from(signedTransaction, 'base64'));
    
    const signature = await connection.sendRawTransaction(
      tx.serialize(),
      { skipPreflight: false, maxRetries: 3 }
    );
    
    logger.info('Transaction sent:', signature);
    
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: tx.recentBlockhash!,
      lastValidBlockHeight
    });
    
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }
    
    res.json({
      signature,
      confirmed: true
    });
  } catch (error) {
    logger.error('Failed to execute transaction:', error);
    res.status(500).json({ error: 'Failed to execute transaction' });
  }
});

// SOL 價格查詢
async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch(`http://localhost:${process.env.PORT || 3002}/api/price/sol`);
    if (!response.ok) {
      throw new Error('Failed to fetch SOL price');
    }
    const data = await response.json();
    return data.price;
  } catch (error) {
    logger.error('Failed to get SOL price:', error);
    throw new Error('SOL price service unavailable');
  }
}

export default router;
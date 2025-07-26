import express from 'express';
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  Keypair, 
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram
} from '@solana/web3.js';
import { Program, AnchorProvider, Idl, web3 } from '@coral-xyz/anchor';
import BN from 'bn.js';
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction
} from '@solana/spl-token';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import IDL from '../types/zuvi.json' assert { type: 'json' };
import { verifyWallet, AuthRequest } from '../middleware/auth.ts';
import { requireProperty } from '../middleware/attestation.ts';
import { createLogger } from '../utils/logger.ts';
import { getSolPrice } from '../services/price.ts';
import type { Zuvi } from '../types/zuvi.ts';

dotenv.config();

const router = express.Router();
const logger = createLogger();

let feePayerKeypair: Keypair;

try {
  const feePayerSecret = process.env.FEE_PAYER_KEYPAIR;
  if (!feePayerSecret) {
    throw new Error('FEE_PAYER_KEYPAIR environment variable is not set');
  }
  feePayerKeypair = Keypair.fromSecretKey(bs58.decode(feePayerSecret));
  logger.info(`Fee payer wallet loaded: ${feePayerKeypair.publicKey.toString()}`);
} catch (error) {
  logger.error('Failed to load fee payer keypair:', error);
  throw error;
}

router.post('/prepare', verifyWallet, requireProperty, async (req: AuthRequest, res) => {
  try {
    const {
      attestPda,  // 接收 attestPda
      ownerAttestation,
      monthlyRent,
      depositMonths,
      propertyDetailsHash
    } = req.body;

    logger.info('Listing prepare request:', {
      attestPda,
      ownerAttestation,
      monthlyRent,
      depositMonths,
      propertyDetailsHash: propertyDetailsHash?.substring(0, 10) + '...'
    });

    if (!attestPda || !ownerAttestation || !monthlyRent || !depositMonths || !propertyDetailsHash) {
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
    const attestPdaPubkey = new PublicKey(attestPda);  // 轉換為 PublicKey
    
    // 正確計算 listing PDA
    const [listingPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('listing'),
        attestPdaPubkey.toBuffer()  // 使用 attestPda 的 buffer
      ],
      programId
    );

    const [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );

    const platform = await program.account.platform.fetch(platformPda);
    
    // 檢查手續費
    const listingFee = new BN(platform.listFee.toString());
    
    // 取得相關 token 帳戶
    const ownerUsdc = await getAssociatedTokenAddress(
      usdcMint,
      owner,
      false,
      TOKEN_PROGRAM_ID
    );

    const platUsdc = await getAssociatedTokenAddress(
      usdcMint,
      platform.feeReceiver,
      false,
      TOKEN_PROGRAM_ID
    );

    // 準備交易
    const transaction = new Transaction();
    
    // 設定計算預算
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 300_000
      })
    );
    
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1000
      })
    );

    // 建立 listing 指令
    const listPropertyIx = await program.methods
      .listProperty(
        attestPdaPubkey,  // 傳入 attestPda
        new BN(monthlyRent),
        depositMonths,
        propertyDetailsHash
      )
      .accountsPartial({
        platform: platformPda,
        listing: listingPda,
        owner: owner,
        ownerUsdc: ownerUsdc,
        platUsdc: platUsdc,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        clock: web3.SYSVAR_CLOCK_PUBKEY
      })
      .instruction();

    transaction.add(listPropertyIx);

    // 取得最新 blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = feePayerKeypair.publicKey;

    // 部分簽名
    transaction.partialSign(feePayerKeypair);

    // 序列化交易
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    const txBase64 = serializedTransaction.toString('base64');

    // 取得 SOL 價格來計算手續費
    const solPrice = await getSolPrice();
    const solCostUsdc = 0.015 * solPrice;

    res.json({
      success: true,
      transaction: {
        txBase64,
        listingPda: listingPda.toString()
      },
      fees: {
        listingFeeUsdc: parseInt(listingFee.toString()) / 1_000_000,
        solCostUsdc,
        totalUsdc: (parseInt(listingFee.toString()) / 1_000_000) + solCostUsdc,
        solPrice
      }
    });

  } catch (error) {
    logger.error('Failed to prepare listing transaction:', error);
    res.status(500).json({ error: 'Failed to prepare transaction' });
  }
});

router.post('/confirm', verifyWallet, requireProperty, async (req: AuthRequest, res) => {
  try {
    const { propertyId, txSignature, listingPda } = req.body;

    if (!propertyId || !txSignature || !listingPda) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const connection = new Connection(`https://${process.env.RPC_ROOT}`);
    
    logger.info('Confirming transaction:', { txSignature });
    
    // 等待交易確認
    const confirmation = await connection.confirmTransaction({
      signature: txSignature,
      blockhash: (await connection.getLatestBlockhash()).blockhash,
      lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error('Transaction failed');
    }

    // 取得 listing 資料
    const programId = new PublicKey(process.env.ZUVI_PROGRAM_ID!);
    const provider = new AnchorProvider(
      connection,
      {} as any,
      { commitment: 'confirmed' }
    );
    
    const program = new Program<Zuvi>(IDL as any, provider);
    const listing = await program.account.propertyListing.fetch(new PublicKey(listingPda));
    
    res.json({
      success: true,
      listing: {
        credentialId: propertyId,
        owner: listing.owner.toString(),
        monthlyRent: listing.mRent.toString(),
        depositMonths: listing.depMonths,
        status: listing.status
      }
    });
    
  } catch (error) {
    logger.error('Failed to confirm transaction:', error);
    res.status(500).json({ error: 'Failed to confirm transaction' });
  }
});

router.get('/fee-payer-balance', async (req, res) => {
  try {
    const connection = new Connection(`https://${process.env.RPC_ROOT}`);
    const balance = await connection.getBalance(feePayerKeypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    res.json({
      address: feePayerKeypair.publicKey.toString(),
      balanceLamports: balance,
      balanceSOL: solBalance,
      isLow: solBalance < 0.1
    });
  } catch (error) {
    logger.error('Failed to get fee payer balance:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

export default router;
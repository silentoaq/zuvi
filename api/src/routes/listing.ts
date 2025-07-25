import express from 'express';
import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import BN from 'bn.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import IDL from '../types/zuvi.json' assert { type: 'json' };
import { verifyWallet, AuthRequest } from '../middleware/auth.ts';
import { requireProperty } from '../middleware/attestation.ts';
import { createLogger } from '../utils/logger.ts';
import { getSolPrice } from '../services/price.ts';
import type { Zuvi } from '../types/zuvi.ts';

// 確保環境變數被載入
dotenv.config();

const router = express.Router();
const logger = createLogger();

// 載入代付錢包
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

// 發布房源交易準備
router.post('/prepare', verifyWallet, requireProperty, async (req: AuthRequest, res) => {
  try {
    const {
      selectedCredentialId,
      ownerAttestation,  // 這是 attestation 的 address (PDA)
      monthlyRent,
      depositMonths,
      propertyDetailsHash
    } = req.body;

    if (!selectedCredentialId || !ownerAttestation || !monthlyRent || !depositMonths || !propertyDetailsHash) {
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
    const attestPda = new PublicKey(ownerAttestation);
    
    // PDA - 使用 attestation address 作為 seed
    const [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );
    
    const [listingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('listing'), attestPda.toBuffer()],
      programId
    );
    
    // 檢查平台是否已初始化
    let platform;
    try {
      platform = await program.account.platform.fetch(platformPda);
    } catch {
      return res.status(400).json({ error: 'Platform not initialized' });
    }
    
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
    
    // 建立交易
    const transaction = new Transaction();
    
    // 建立指令 - attestPda 就是 ownerAttestation
    const instruction = await program.methods
      .listProperty(
        attestPda,                        // attestPda (PublicKey)
        new BN(monthlyRent),              // mRent
        depositMonths,                    // depMonths (u8)
        propertyDetailsHash               // details (string)
      )
      .accountsPartial({
        platform: platformPda,
        listing: listingPda,
        owner,
        ownerUsdc: ownerUsdcAccount,
        platUsdc: platformUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        clock: PublicKey.default
      })
      .instruction();
      
    transaction.add(instruction);
    
    // 設定代付者
    transaction.feePayer = feePayerKeypair.publicKey;
    
    // 取得最新區塊雜湊
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // 部分簽名（代付者簽名）
    transaction.partialSign(feePayerKeypair);
    
    // 序列化交易供前端簽名
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });
    
    // 計算費用
    const listingFee = platform.listFee.toNumber();  
    const solPrice = await getSolPrice();
    
    res.json({
      transaction: serializedTransaction.toString('base64'),
      listingPda: listingPda.toString(),
      fees: {
        listingFeeUsdc: listingFee,
        solPriceUsdc: solPrice
      },
      lastValidBlockHeight
    });
    
  } catch (error) {
    logger.error('Failed to prepare listing transaction:', error);
    res.status(500).json({ error: 'Failed to prepare transaction' });
  }
});

// 確認交易
router.post('/confirm', verifyWallet, async (req: AuthRequest, res) => {
  try {
    const { signature, listingPda, propertyId } = req.body;  
    
    if (!signature || !listingPda || !propertyId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const connection = new Connection(`https://${process.env.RPC_ROOT}`);
    
    // 等待交易確認
    const result = await connection.confirmTransaction(signature, 'confirmed');
    
    if (result.value.err) {
      throw new Error('Transaction failed');
    }
    
    // 查詢鏈上資料確認成功
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

export default router;
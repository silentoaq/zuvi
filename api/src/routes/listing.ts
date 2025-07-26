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
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import BN from 'bn.js';
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
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
      selectedCredentialId,
      ownerAttestation,
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
    
    const [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );
    
    const [listingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('listing'), attestPda.toBuffer()],
      programId
    );

    let platform;
    try {
      platform = await program.account.platform.fetch(platformPda);
    } catch {
      return res.status(400).json({ error: 'Platform not initialized' });
    }
    
    const ownerUsdcAccount = await getAssociatedTokenAddress(
      usdcMint,
      owner
    );
    
    const platformUsdcAccount = await getAssociatedTokenAddress(
      usdcMint,
      platformPda,
      true
    );
    
    const transaction = new Transaction();
    
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 300000
      }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 5000
      })
    );
    
    let totalSolCost = 0;
    
    const platformUsdcAccountInfo = await connection.getAccountInfo(platformUsdcAccount);
    if (!platformUsdcAccountInfo) {
      const rentExemptBalance = await connection.getMinimumBalanceForRentExemption(165);
      totalSolCost += rentExemptBalance / LAMPORTS_PER_SOL;
      
      const createATAIx = createAssociatedTokenAccountInstruction(
        feePayerKeypair.publicKey,
        platformUsdcAccount,
        platformPda,
        usdcMint
      );
      transaction.add(createATAIx);
    }
    
    const ownerUsdcAccountInfo = await connection.getAccountInfo(ownerUsdcAccount);
    if (!ownerUsdcAccountInfo) {
      const rentExemptBalance = await connection.getMinimumBalanceForRentExemption(165);
      totalSolCost += rentExemptBalance / LAMPORTS_PER_SOL;
      
      const createOwnerATAIx = createAssociatedTokenAccountInstruction(
        feePayerKeypair.publicKey,
        ownerUsdcAccount,
        owner,
        usdcMint
      );
      transaction.add(createOwnerATAIx);
    }
    
    const listingAccountInfo = await connection.getAccountInfo(listingPda);
    if (!listingAccountInfo) {
      const LISTING_SIZE = 8 + 32 + 32 + 8 + 1 + 32 + 32 + 1 + 8 + 1 + 200;
      const rentExemptBalance = await connection.getMinimumBalanceForRentExemption(LISTING_SIZE);
      totalSolCost += rentExemptBalance / LAMPORTS_PER_SOL;
    }
    
    const baseTransactionFee = 5000;
    const computeUnits = 300000;
    const computeUnitPrice = 5000;
    const priorityFee = (computeUnits * computeUnitPrice) / 1_000_000;
    totalSolCost += (baseTransactionFee + priorityFee) / LAMPORTS_PER_SOL;
    
    const solPrice = await getSolPrice();
    const totalSolCostInUsdc = Math.ceil(totalSolCost * solPrice * 1_000_000);
    
    const listingFee = platform.listFee.toNumber();
    const totalUsdcCost = listingFee + totalSolCostInUsdc;
    
    const listInstruction = await program.methods
      .listProperty(
        attestPda,
        new BN(monthlyRent),
        depositMonths,
        propertyDetailsHash
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
      
    transaction.add(listInstruction);
    
    transaction.feePayer = feePayerKeypair.publicKey;
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    transaction.partialSign(feePayerKeypair);
    
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });
    
    res.json({
      transaction: serializedTransaction.toString('base64'),
      listingPda: listingPda.toString(),
      fees: {
        listingFeeUsdc: listingFee,
        solCostUsdc: totalSolCostInUsdc,
        totalUsdc: totalUsdcCost,
        solPrice: solPrice
      },
      lastValidBlockHeight
    });
    
  } catch (error) {
    logger.error('Failed to prepare listing transaction:', error);
    res.status(500).json({ error: 'Failed to prepare transaction' });
  }
});

router.post('/confirm', verifyWallet, async (req: AuthRequest, res) => {
  try {
    const { signature, listingPda, propertyId } = req.body;
    
    if (!signature || !listingPda || !propertyId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const connection = new Connection(`https://${process.env.RPC_ROOT}`);
    
    const result = await connection.confirmTransaction(signature, 'confirmed');
    
    if (result.value.err) {
      throw new Error('Transaction failed');
    }
    
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
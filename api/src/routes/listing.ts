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
      attestPda,
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
    const attestPdaPubkey = new PublicKey(attestPda);
    
    const [listingPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('listing'),
        attestPdaPubkey.toBuffer()
      ],
      programId
    );

    const [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform')],
      programId
    );

    const platform = await program.account.platform.fetch(platformPda);
    const listingFee = new BN(platform.listFee.toString());
    
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

    logger.info('Account addresses:', {
      owner: owner.toString(),
      ownerUsdc: ownerUsdc.toString(),
      feeReceiver: platform.feeReceiver.toString(),
      platUsdc: platUsdc.toString(),
      usdcMint: usdcMint.toString()
    });

    const transaction = new Transaction();
    
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 400_000
      })
    );
    
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 5000
      })
    );

    const ownerUsdcInfo = await connection.getAccountInfo(ownerUsdc);
    if (!ownerUsdcInfo) {
      logger.info('Creating owner USDC account...');
      const createOwnerUsdcIx = createAssociatedTokenAccountInstruction(
        feePayerKeypair.publicKey,  // payer
        ownerUsdc,                   // associatedToken
        owner,                       // owner
        usdcMint,                    // mint
        TOKEN_PROGRAM_ID
      );
      transaction.add(createOwnerUsdcIx);
    }

    const platUsdcInfo = await connection.getAccountInfo(platUsdc);
    if (!platUsdcInfo) {
      logger.info('Creating platform USDC account...');
      const createPlatUsdcIx = createAssociatedTokenAccountInstruction(
        feePayerKeypair.publicKey,  // payer
        platUsdc,                    // associatedToken
        platform.feeReceiver,        // owner
        usdcMint,                    // mint
        TOKEN_PROGRAM_ID
      );
      transaction.add(createPlatUsdcIx);
    }

    const listPropertyIx = await program.methods
      .listProperty(
        attestPdaPubkey,
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

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = feePayerKeypair.publicKey;
    
    transaction.partialSign(feePayerKeypair);

    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    const txBase64 = serializedTransaction.toString('base64');

    const solPrice = await getSolPrice();
    const solCostUsdc = 0.015 * solPrice;

    res.json({
      success: true,
      transaction: txBase64,
      listingPda: listingPda.toString(),
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

router.post('/execute', verifyWallet, requireProperty, async (req: AuthRequest, res) => {
  try {
    const { signedTransaction, listingPda, propertyId } = req.body;

    if (!signedTransaction || !listingPda || !propertyId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const connection = new Connection(`https://${process.env.RPC_ROOT}`);
    
    const transaction = Transaction.from(Buffer.from(signedTransaction, 'base64'));
    
    logger.info('Executing transaction:', {
      feePayer: transaction.feePayer?.toString(),
      signatures: transaction.signatures.map(sig => ({
        publicKey: sig.publicKey?.toString(),
        signature: sig.signature ? 'present' : 'missing'
      }))
    });
    
    try {
      const signature = await connection.sendRawTransaction(transaction.serialize());
      logger.info('Transaction sent:', signature);
      
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: transaction.recentBlockhash!,
        lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
      }, 'confirmed');

      if (confirmation.value.err) {
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
        signature,
        listing: {
          credentialId: propertyId,
          owner: listing.owner.toString(),
          monthlyRent: listing.mRent.toString(),
          depositMonths: listing.depMonths,
          status: listing.status
        }
      });
    } catch (sendError: any) {
      logger.error('Transaction failed:', {
        error: sendError.message,
        logs: sendError.logs
      });
      
      if (sendError.logs) {
        res.status(500).json({ 
          error: 'Transaction failed', 
          logs: sendError.logs,
          message: sendError.message 
        });
      } else {
        res.status(500).json({ error: sendError.message });
      }
    }
    
  } catch (error) {
    logger.error('Failed to execute transaction:', error);
    res.status(500).json({ error: 'Failed to execute transaction' });
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
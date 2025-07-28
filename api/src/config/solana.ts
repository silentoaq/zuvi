import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { Zuvi } from '../types/zuvi';
import zuvi_idl from '../idl/zuvi.json';
import bs58 from 'bs58';

export const connection = new Connection(
  process.env.SOLANA_RPC_URL!,
  'confirmed'
);

// API 簽名者錢包
const apiSignerKeypair = Keypair.fromSecretKey(
  bs58.decode(process.env.API_SIGNER_PRIVATE_KEY!)
);

export const apiSignerWallet = new Wallet(apiSignerKeypair);

// 創建 Provider
const provider = new AnchorProvider(
  connection,
  apiSignerWallet,
  { commitment: 'confirmed' }
);

// 創建 Program
export const program = new Program<Zuvi>(
  zuvi_idl as Zuvi,
  provider
);

export const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);
export const USDC_MINT = new PublicKey(process.env.USDC_MINT!);

// PDA 衍生函數
export const derivePDAs = {
  config: () => 
    PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      PROGRAM_ID
    ),
    
  listing: (propertyAttest: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("list"), propertyAttest.toBuffer()],
      PROGRAM_ID
    ),
    
  application: (listing: PublicKey, applicant: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("apply"), listing.toBuffer(), applicant.toBuffer()],
      PROGRAM_ID
    ),
    
  lease: (listing: PublicKey, tenant: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("lease"), listing.toBuffer(), tenant.toBuffer()],
      PROGRAM_ID
    ),
    
  escrow: (lease: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), lease.toBuffer()],
      PROGRAM_ID
    ),
    
  escrowToken: (lease: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_token"), lease.toBuffer()],
      PROGRAM_ID
    ),
    
  dispute: (lease: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("dispute"), lease.toBuffer()],
      PROGRAM_ID
    )
};
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { Zuvi } from '../types/zuvi';
import zuvi_idl from '../idl/zuvi.json';
import bs58 from 'bs58';

let connection: Connection;
let provider: AnchorProvider;
let program: Program<Zuvi>;
let PROGRAM_ID: PublicKey;
let USDC_MINT: PublicKey;
let apiSignerWallet: Wallet;
let apiSignerKeypair: Keypair;

let initialized = false;

export function initSolana() {
  if (initialized) return;

  const rpcUrl = process.env.SOLANA_RPC_URL;
  const privateKey = process.env.API_SIGNER_PRIVATE_KEY;
  const programIdStr = process.env.PROGRAM_ID;
  const usdcMintStr = process.env.USDC_MINT;

  if (!rpcUrl || !rpcUrl.startsWith('http')) throw new Error('Invalid SOLANA_RPC_URL');
  if (!privateKey) throw new Error('Missing API_SIGNER_PRIVATE_KEY');
  if (!programIdStr) throw new Error('Missing PROGRAM_ID');
  if (!usdcMintStr) throw new Error('Missing USDC_MINT');

  connection = new Connection(rpcUrl, 'confirmed');
  apiSignerKeypair = Keypair.fromSecretKey(bs58.decode(privateKey));
  apiSignerWallet = new Wallet(apiSignerKeypair);
  provider = new AnchorProvider(connection, apiSignerWallet, { commitment: 'confirmed' });
  program = new Program<Zuvi>(zuvi_idl as Zuvi, provider);
  PROGRAM_ID = new PublicKey(programIdStr);
  USDC_MINT = new PublicKey(usdcMintStr);

  initialized = true;
}

export {
  connection,
  provider,
  program,
  PROGRAM_ID,
  USDC_MINT,
  apiSignerWallet,
  apiSignerKeypair,
};

export const derivePDAs = {
  config: () =>
    PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID),
  listing: (propertyAttest: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from('list'), propertyAttest.toBuffer()], PROGRAM_ID),
  application: (listing: PublicKey, applicant: PublicKey, createdAt: BN) =>
    PublicKey.findProgramAddressSync([
      Buffer.from('apply'), 
      listing.toBuffer(), 
      applicant.toBuffer(),
      createdAt.toBuffer('le', 8)
    ], PROGRAM_ID),
  lease: (listing: PublicKey, tenant: PublicKey, startDate: BN) =>
    PublicKey.findProgramAddressSync([
      Buffer.from('lease'), 
      listing.toBuffer(), 
      tenant.toBuffer(),
      startDate.toBuffer('le', 8)
    ], PROGRAM_ID),
  escrow: (lease: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from('escrow'), lease.toBuffer()], PROGRAM_ID),
  escrowToken: (lease: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from('escrow_token'), lease.toBuffer()], PROGRAM_ID),
  dispute: (lease: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from('dispute'), lease.toBuffer()], PROGRAM_ID),
};
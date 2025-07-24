import express from 'express';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import IDL from '../types/zuvi.json' assert { type: 'json' };
import type { Zuvi } from '../types/zuvi.ts';
import { createLogger } from '../utils/logger.ts';

const router = express.Router();
const logger = createLogger();

let connection: Connection;
let programId: PublicKey;

const initializeConnection = () => {
  if (!connection) {
    connection = new Connection(`https://${process.env.RPC_ROOT}`);
  }
  if (!programId) {
    programId = new PublicKey(process.env.ZUVI_PROGRAM_ID!);
  }
};

// 獲取房源列表
router.get('/', async (req, res) => {
  try {
    initializeConnection();
    
    const provider = new AnchorProvider(
      connection,
      {} as any,
      { commitment: 'confirmed' }
    );
    
    const program = new Program<Zuvi>(IDL as any, provider);
    
    const listings = await program.account.propertyListing.all();
    
    const formattedListings = listings
      .filter(item => item.account.status.available !== undefined)
      .map(item => ({
        publicKey: item.publicKey.toString(),
        propertyId: item.account.propertyId,
        owner: item.account.owner.toString(),
        ownerAttestation: item.account.ownerAttestation,
        monthlyRent: item.account.monthlyRent.toNumber(),
        depositMonths: item.account.depositMonths,
        propertyDetailsHash: item.account.propertyDetailsHash,
        createdAt: item.account.createdAt.toNumber()
      }));
    
    res.json({
      total: formattedListings.length,
      listings: formattedListings
    });
  } catch (error) {
    logger.error('Failed to fetch properties:', error);
    res.status(500).json({ 
      error: 'Failed to fetch properties' 
    });
  }
});

// 獲取單個房源詳情
router.get('/:propertyId', async (req, res) => {
  try {
    initializeConnection();
    
    const { propertyId } = req.params;
    
    const [listingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('listing'), Buffer.from(propertyId)],
      programId
    );
    
    const provider = new AnchorProvider(
      connection,
      {} as any,
      { commitment: 'confirmed' }
    );
    
    const program = new Program<Zuvi>(IDL as any, provider);
    
    try {
      const listing = await program.account.propertyListing.fetch(listingPda);
      
      res.json({
        publicKey: listingPda.toString(),
        propertyId: listing.propertyId,
        owner: listing.owner.toString(),
        ownerAttestation: listing.ownerAttestation,
        monthlyRent: listing.monthlyRent.toNumber(),
        depositMonths: listing.depositMonths,
        propertyDetailsHash: listing.propertyDetailsHash,
        status: listing.status,
        currentContract: listing.currentContract?.toString() || null,
        createdAt: listing.createdAt.toNumber()
      });
    } catch (e) {
      res.status(404).json({ 
        error: 'Property not found' 
      });
    }
  } catch (error) {
    logger.error('Failed to fetch property:', error);
    res.status(500).json({ 
      error: 'Failed to fetch property' 
    });
  }
});

export default router;
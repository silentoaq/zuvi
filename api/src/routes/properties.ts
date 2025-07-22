import express from 'express';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import IDL from '../types/zuvi.json' assert { type: 'json' };
import type { Zuvi } from '../types/zuvi.ts';
import { createLogger } from '../utils/logger.ts';

const router = express.Router();
const logger = createLogger();

// Solana 連接
const connection = new Connection(`https://${process.env.RPC_ROOT}`);
const programId = new PublicKey(process.env.ZUVI_PROGRAM_ID!);

// 取得所有房源
router.get('/', async (req, res) => {
  try {
    // 使用只讀 provider
    const provider = new AnchorProvider(
      connection,
      {} as any, // 只讀操作不需要錢包
      { commitment: 'confirmed' }
    );
    
    const program = new Program<Zuvi>(IDL as any, provider);
    
    // 獲取所有 PropertyListing 帳戶
    const listings = await program.account.propertyListing.all();
    
    // 過濾並格式化資料
    const formattedListings = listings
      .filter(item => item.account.status.available !== undefined) // 只顯示可租房源
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

// 取得單一房源詳情
router.get('/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    // 計算 PDA
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
        currentTenant: listing.currentTenant?.toString() || null,
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
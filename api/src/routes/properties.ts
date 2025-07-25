import express from 'express';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import IDL from '../types/zuvi.json' assert { type: 'json' };
import type { Zuvi } from '../types/zuvi.ts';
import { createLogger } from '../utils/logger.ts';
import { getFromIPFS } from '../services/ipfs.ts';

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

// 取得所有房源列表
router.get('/', async (req, res) => {
  try {
    initializeConnection();
    
    const provider = new AnchorProvider(
      connection,
      {} as any,
      { commitment: 'confirmed' }
    );
    
    const program = new Program<Zuvi>(IDL as any, provider);
    
    // 取得所有 listing 帳戶
    const listings = await program.account.propertyListing.all();
    
    // 處理每個 listing
    const processedListings = await Promise.all(
      listings.map(async (listing) => {
        try {
          // 從 IPFS 取得詳細資訊
          let propertyDetails = null;
          if (listing.account.details) {
            try {
              propertyDetails = await getFromIPFS(listing.account.details);
            } catch (error) {
              logger.error('Failed to fetch from IPFS:', error);
            }
          }
          
          return {
            publicKey: listing.publicKey.toString(),
            owner: listing.account.owner.toString(),
            attestPda: listing.account.attestPda.toString(),
            monthlyRent: listing.account.mRent.toString(),
            depositMonths: listing.account.depMonths,
            status: listing.account.status,
            createdAt: listing.account.created.toNumber(),
            // 從 IPFS 資料中取得地址，如果沒有就用 attestPda 的前幾碼
            propertyId: propertyDetails?.features?.address || 
                       `Property-${listing.publicKey.toString().slice(0, 8)}`,
            propertyDetailsHash: listing.account.details,
            // 額外的詳細資訊
            details: propertyDetails
          };
        } catch (error) {
          logger.error('Error processing listing:', error);
          return null;
        }
      })
    );
    
    // 過濾掉處理失敗的項目
    const validListings = processedListings.filter(listing => listing !== null);
    
    res.json({
      listings: validListings,
      count: validListings.length
    });
    
  } catch (error) {
    logger.error('Failed to fetch properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// 取得單一房源詳情
router.get('/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;
    
    initializeConnection();
    
    const provider = new AnchorProvider(
      connection,
      {} as any,
      { commitment: 'confirmed' }
    );
    
    const program = new Program<Zuvi>(IDL as any, provider);
    
    // 取得 listing 帳戶
    const listingPubkey = new PublicKey(publicKey);
    const listing = await program.account.propertyListing.fetch(listingPubkey);
    
    // 從 IPFS 取得詳細資訊
    let propertyDetails = null;
    if (listing.details) {
      try {
        propertyDetails = await getFromIPFS(listing.details);
      } catch (error) {
        logger.error('Failed to fetch from IPFS:', error);
      }
    }
    
    res.json({
      publicKey: publicKey,
      owner: listing.owner.toString(),
      attestPda: listing.attestPda.toString(),
      monthlyRent: listing.mRent.toString(),
      depositMonths: listing.depMonths,
      status: listing.status,
      createdAt: listing.created.toNumber(),
      propertyId: propertyDetails?.features?.address || 
                 `Property-${publicKey.slice(0, 8)}`,
      propertyDetailsHash: listing.details,
      details: propertyDetails
    });
    
  } catch (error) {
    logger.error('Failed to fetch property:', error);
    res.status(500).json({ error: 'Failed to fetch property details' });
  }
});

export default router;
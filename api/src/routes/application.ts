import { Router } from 'express';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { program, derivePDAs, apiSignerWallet } from '../config/solana';
import { CredentialService } from '../services/credential';
import { StorageService } from '../services/storage';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest, requireCitizenCredential } from '../middleware/auth';
import { broadcastToUser } from '../ws/websocket';
import { BN } from '@coral-xyz/anchor';

const router = Router();

router.post('/apply', requireCitizenCredential, async (req: AuthRequest, res, next) => {
  try {
    const { listing, message } = req.body;
    const userPublicKey = new PublicKey(req.user!.publicKey);

    if (!listing || !message) {
      throw new ApiError(400, 'Missing required fields');
    }

    const listingPubkey = new PublicKey(listing);
    const listingAccount = await program.account.listing.fetch(listingPubkey);

    if (listingAccount.status !== 0) {
      throw new ApiError(400, 'Listing is not available');
    }

    const status = await CredentialService.getCredentialStatus(req.user!.publicKey);
    if (!status.twfido?.exists) {
      throw new ApiError(403, 'Citizen credential required');
    }

    const createdAt = new BN(Math.floor(Date.now() / 1000));
    const ipfsResult = await StorageService.uploadJSON(message, 'apply', req.user!.publicKey);
    const messageUriBytes = StorageService.ipfsHashToBytes(ipfsResult.ipfsHash);

    const [applicationPda] = derivePDAs.application(listingPubkey, userPublicKey, createdAt);

    const tx = await program.methods
      .applyLease(
        Array.from(messageUriBytes),
        createdAt
      )
      .accountsStrict({
        config: derivePDAs.config()[0],
        listing: listingPubkey,
        application: applicationPda,
        applicant: userPublicKey,
        apiSigner: apiSignerWallet.publicKey,
        tenantAttest: new PublicKey(status.twfido.address!),
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;

    tx.partialSign(apiSignerWallet.payer);

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    broadcastToUser(listingAccount.owner.toString(), {
      type: 'new_application',
      listing: listing,
      applicant: req.user!.publicKey,
      message: '有新的租房申請'
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64'),
      cleanup: {
        ipfsHash: ipfsResult.ipfsHash
      }
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:applicationId', async (req: AuthRequest, res, next) => {
  try {
    const { applicationId } = req.params;
    const userPublicKey = new PublicKey(req.user!.publicKey);
    const applicationPubkey = new PublicKey(applicationId);

    const applicationAccount = await program.account.application.fetch(applicationPubkey);
    if (!applicationAccount.applicant.equals(userPublicKey)) {
      throw new ApiError(403, 'Not the applicant of this application');
    }

    if (applicationAccount.status !== 0 && applicationAccount.status !== 2) {
      throw new ApiError(400, 'Cannot cancel approved application');
    }

    const messageIpfsHash = StorageService.bytesToIpfsHash(applicationAccount.messageUri);

    const tx = await program.methods
      .closeApplication(
        userPublicKey,
        applicationAccount.createdAt
      )
      .accountsStrict({
        application: applicationPubkey,
        applicant: userPublicKey,
      })
      .transaction();

    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    const listingAccount = await program.account.listing.fetch(applicationAccount.listing);
    broadcastToUser(listingAccount.owner.toString(), {
      type: 'application_cancelled',
      listing: applicationAccount.listing.toString(),
      applicant: userPublicKey.toString(),
      message: '申請人已撤回申請'
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64'),
      cleanup: {
        messageIpfsHash: messageIpfsHash
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:listing/cancel-approved/:applicant', async (req: AuthRequest, res, next) => {
  try {
    const { listing, applicant } = req.params;
    const userPublicKey = new PublicKey(req.user!.publicKey);
    const listingPubkey = new PublicKey(listing);
    const applicantPubkey = new PublicKey(applicant);

    const listingAccount = await program.account.listing.fetch(listingPubkey);
    
    const isOwner = listingAccount.owner.equals(userPublicKey);
    const isApplicant = applicantPubkey.equals(userPublicKey);
    
    if (!isOwner && !isApplicant) {
      throw new ApiError(403, 'Not authorized to cancel this application');
    }

    const applications = await program.account.application.all([
      {
        memcmp: {
          offset: 8,
          bytes: listingPubkey.toBase58()
        }
      },
      {
        memcmp: {
          offset: 8 + 32,
          bytes: applicantPubkey.toBase58()
        }
      }
    ]);

    if (applications.length === 0) {
      throw new ApiError(404, 'Application not found');
    }

    const application = applications[0];
    if (application.account.status !== 1) {
      throw new ApiError(400, 'Application is not approved');
    }

    if (listingAccount.hasActiveLease) {
      throw new ApiError(400, 'Cannot cancel - lease already active');
    }

    const applicationCreatedAt = application.account.createdAt;

    const tx = await program.methods
      .cancelApprovedApplication(
        applicantPubkey,
        applicationCreatedAt
      )
      .accountsStrict({
        listing: listingPubkey,
        application: application.publicKey,
        signer: userPublicKey,
      })
      .transaction();

    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    if (isOwner) {
      broadcastToUser(applicant, {
        type: 'approved_application_cancelled',
        listing: listing,
        cancelledBy: 'landlord',
        message: '房東已取消您的已核准申請'
      });
    } else {
      broadcastToUser(listingAccount.owner.toString(), {
        type: 'approved_application_cancelled',
        listing: listing,
        applicant: applicant,
        cancelledBy: 'tenant',
        message: '承租人已取消已核准的申請'
      });
    }

    res.json({
      success: true,
      transaction: serialized.toString('base64')
    });
  } catch (error) {
    next(error);
  }
});

router.get('/listing/:listing', async (req: AuthRequest, res, next) => {
  try {
    const { listing } = req.params;
    const userPublicKey = new PublicKey(req.user!.publicKey);
    const listingPubkey = new PublicKey(listing);

    const listingAccount = await program.account.listing.fetch(listingPubkey);
    if (!listingAccount.owner.equals(userPublicKey)) {
      throw new ApiError(403, 'Not the owner of this listing');
    }

    const applications = await program.account.application.all([
      {
        memcmp: {
          offset: 8,
          bytes: listingPubkey.toBase58()
        }
      }
    ]);

    const enriched = await Promise.all(
      applications.map(async (app) => {
        const ipfsHash = StorageService.bytesToIpfsHash(app.account.messageUri);
        let message = null;

        try {
          message = await StorageService.getJSON(ipfsHash);
        } catch (error) {
          message = {
            error: 'Unable to fetch application details',
            ipfsHash
          };
        }

        return {
          publicKey: app.publicKey.toString(),
          applicant: app.account.applicant.toString(),
          tenantAttest: app.account.tenantAttest.toString(),
          status: app.account.status,
          createdAt: app.account.createdAt.toNumber(),
          message,
          ipfsHash
        };
      })
    );

    res.json({
      applications: enriched,
      total: enriched.length
    });
  } catch (error) {
    next(error);
  }
});

router.get('/my', async (req: AuthRequest, res, next) => {
  try {
    const userPublicKey = new PublicKey(req.user!.publicKey);

    const applications = await program.account.application.all([
      {
        memcmp: {
          offset: 8 + 32,
          bytes: userPublicKey.toBase58()
        }
      }
    ]);

    const enriched = await Promise.all(
      applications.map(async (app) => {
        const listingAccount = await program.account.listing.fetch(app.account.listing);
        
        let listingMetadata = null;
        try {
          const listingIpfsHash = StorageService.bytesToIpfsHash(listingAccount.metadataUri);
          listingMetadata = await StorageService.getJSON(listingIpfsHash);
        } catch {}

        let message = null;
        const ipfsHash = StorageService.bytesToIpfsHash(app.account.messageUri);
        try {
          message = await StorageService.getJSON(ipfsHash);
        } catch {}

        return {
          publicKey: app.publicKey.toString(),
          listing: {
            publicKey: app.account.listing.toString(),
            address: Buffer.from(listingAccount.address).toString('utf8').replace(/\0/g, ''),
            rent: listingAccount.rent.toString(),
            deposit: listingAccount.deposit.toString(),
            metadata: listingMetadata
          },
          status: app.account.status,
          createdAt: app.account.createdAt.toNumber(),
          message,
          ipfsHash
        };
      })
    );

    res.json({
      applications: enriched,
      total: enriched.length
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:listing/approve/:applicant', async (req: AuthRequest, res, next) => {
  try {
    const { listing, applicant } = req.params;
    const userPublicKey = new PublicKey(req.user!.publicKey);

    const listingPubkey = new PublicKey(listing);
    const applicantPubkey = new PublicKey(applicant);

    const listingAccount = await program.account.listing.fetch(listingPubkey);
    if (!listingAccount.owner.equals(userPublicKey)) {
      throw new ApiError(403, 'Not the owner of this listing');
    }

    const applications = await program.account.application.all([
      {
        memcmp: {
          offset: 8,
          bytes: listingPubkey.toBase58()
        }
      },
      {
        memcmp: {
          offset: 8 + 32,
          bytes: applicantPubkey.toBase58()
        }
      }
    ]);

    if (applications.length === 0) {
      throw new ApiError(404, 'Application not found');
    }

    const application = applications[0];
    if (application.account.status !== 0) {
      throw new ApiError(400, 'Application already processed');
    }

    const applicationCreatedAt = application.account.createdAt;

    const tx = await program.methods
      .approveApplication(
        applicantPubkey,
        applicationCreatedAt
      )
      .accountsStrict({
        listing: listingPubkey,
        application: application.publicKey,
        owner: userPublicKey,
      })
      .transaction();

    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    broadcastToUser(applicant, {
      type: 'application_approved',
      listing: listing,
      landlord: req.user!.publicKey,
      message: '您的租房申請已被批准'
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64')
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:listing/reject/:applicant', async (req: AuthRequest, res, next) => {
  try {
    const { listing, applicant } = req.params;
    const userPublicKey = new PublicKey(req.user!.publicKey);

    const listingPubkey = new PublicKey(listing);
    const applicantPubkey = new PublicKey(applicant);

    const listingAccount = await program.account.listing.fetch(listingPubkey);
    if (!listingAccount.owner.equals(userPublicKey)) {
      throw new ApiError(403, 'Not the owner of this listing');
    }

    const applications = await program.account.application.all([
      {
        memcmp: {
          offset: 8,
          bytes: listingPubkey.toBase58()
        }
      },
      {
        memcmp: {
          offset: 8 + 32,
          bytes: applicantPubkey.toBase58()
        }
      }
    ]);

    if (applications.length === 0) {
      throw new ApiError(404, 'Application not found');
    }

    const application = applications[0];
    if (application.account.status !== 0) {
      throw new ApiError(400, 'Application already processed');
    }

    const applicationCreatedAt = application.account.createdAt;

    const tx = await program.methods
      .rejectApplication(
        applicantPubkey,
        applicationCreatedAt
      )
      .accountsStrict({
        listing: listingPubkey,
        application: application.publicKey,
        owner: userPublicKey,
      })
      .transaction();

    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    broadcastToUser(applicant, {
      type: 'application_rejected',
      listing: listing,
      landlord: req.user!.publicKey,
      message: '您的租房申請已被拒絕'
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64')
    });
  } catch (error) {
    next(error);
  }
});
  
export { router as applicationRouter };
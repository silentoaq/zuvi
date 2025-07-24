import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Zuvi } from "../target/types/zuvi";
import { assert } from "chai";
import { PublicKey, Keypair } from "@solana/web3.js";
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";

describe("zuvi", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Zuvi as Program<Zuvi>;
  
  let usdcMint: PublicKey;
  let platformPda: PublicKey;
  let mintAuthority: Keypair;
  let landlord: Keypair;
  let tenant: Keypair;
  let feeReceiver: Keypair;
  
  let landlordUsdcAccount: any;
  let tenantUsdcAccount: any;
  let feeReceiverUsdcAccount: any;
  let platformUsdcAccount: any;

  const FEES = {
    listing: new anchor.BN(10_000),     // 0.01 USDC
    contract: new anchor.BN(50_000),    // 0.05 USDC
    payment: new anchor.BN(5_000),      // 0.005 USDC
  };

  before(async () => {
    mintAuthority = Keypair.generate();
    landlord = Keypair.generate();
    tenant = Keypair.generate();
    feeReceiver = Keypair.generate();

    await provider.connection.requestAirdrop(mintAuthority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(landlord.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(tenant.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(feeReceiver.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

    await new Promise(resolve => setTimeout(resolve, 1000));

    usdcMint = await createMint(
      provider.connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      6
    );

    landlordUsdcAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      landlord,
      usdcMint,
      landlord.publicKey
    );

    tenantUsdcAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      tenant,
      usdcMint,
      tenant.publicKey
    );

    feeReceiverUsdcAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      feeReceiver,
      usdcMint,
      feeReceiver.publicKey
    );

    await mintTo(
      provider.connection,
      mintAuthority,
      usdcMint,
      landlordUsdcAccount.address,
      mintAuthority.publicKey,
      10_000_000_000
    );

    await mintTo(
      provider.connection,
      mintAuthority,
      usdcMint,
      tenantUsdcAccount.address,
      mintAuthority.publicKey,
      10_000_000_000
    );

    [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("platform")],
      program.programId
    );

    platformUsdcAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      feeReceiver,
      usdcMint,
      feeReceiver.publicKey
    );
  });

  it("Initializes the platform", async () => {
    const tx = await program.methods
      .initializePlatform(FEES.listing, FEES.contract, FEES.payment)
      .accountsPartial({
        platform: platformPda,
        authority: provider.wallet.publicKey,
        feeReceiver: feeReceiver.publicKey,
        usdcMint: usdcMint,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const platform = await program.account.platform.fetch(platformPda);
    
    assert.equal(platform.authority.toString(), provider.wallet.publicKey.toString());
    assert.equal(platform.feeReceiver.toString(), feeReceiver.publicKey.toString());
    assert.equal(platform.listingFee.toNumber(), FEES.listing.toNumber());
    assert.equal(platform.contractFee.toNumber(), FEES.contract.toNumber());
    assert.equal(platform.paymentFee.toNumber(), FEES.payment.toNumber());
    assert.equal(platform.usdcMint.toString(), usdcMint.toString());
    assert.isTrue(platform.isInitialized);
  });

  it("Lists a property", async () => {
    const propertyId = "test-property-001";
    const ownerAttestation = "twland:verified:12345";
    const monthlyRent = new anchor.BN(1_000_000_000); // 1000 USDC
    const depositMonths = 2;
    const propertyDetailsHash = "QmTestIPFSHash123";

    const [listingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), Buffer.from(propertyId)],
      program.programId
    );

    const tx = await program.methods
      .listProperty(
        propertyId,
        ownerAttestation,
        monthlyRent,
        depositMonths,
        propertyDetailsHash
      )
      .accountsPartial({
        platform: platformPda,
        listing: listingPda,
        owner: landlord.publicKey,
        ownerUsdcAccount: landlordUsdcAccount.address,
        platformUsdcAccount: platformUsdcAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      })
      .signers([landlord])
      .rpc();

    const listing = await program.account.propertyListing.fetch(listingPda);
    
    assert.equal(listing.propertyId, propertyId);
    assert.equal(listing.owner.toString(), landlord.publicKey.toString());
    assert.equal(listing.ownerAttestation, ownerAttestation);
    assert.equal(listing.monthlyRent.toNumber(), monthlyRent.toNumber());
    assert.equal(listing.depositMonths, depositMonths);
    assert.equal(listing.propertyDetailsHash, propertyDetailsHash);
    assert.deepEqual(listing.status, { available: {} });
  });
});
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Zuvi } from "../target/types/zuvi";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  createMint, 
  createAccount, 
  mintTo, 
  getAccount,
  getAssociatedTokenAddress,
  createAssociatedTokenAccount
} from "@solana/spl-token";
import { assert } from "chai";

describe("zuvi", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Zuvi as Program<Zuvi>;
  const connection = provider.connection;

  // 測試帳戶
  let authority: Keypair;
  let feeReceiver: Keypair;
  let owner: Keypair;
  let applicant: Keypair;
  let usdcMint: PublicKey;
  let escrowUsdcKeypair: Keypair; // 託管帳戶
  
  // PDAs
  let platformPda: PublicKey;
  let listingPda: PublicKey;
  let applicationPda: PublicKey;
  let contractPda: PublicKey;
  let escrowPda: PublicKey;
  
  // 測試資料
  const attestPdaOwner = Keypair.generate().publicKey;
  const attestPdaApplicant = Keypair.generate().publicKey;
  const listFee = new anchor.BN(1_000_000); // 1 USDC
  const cFee = new anchor.BN(5_000_000); // 5 USDC  
  const payFee = new anchor.BN(500_000); // 0.5 USDC
  const mRent = new anchor.BN(30_000_000_000); // 30000 USDC
  const depMonths = 2;
  const offerRent = new anchor.BN(28_000_000_000); // 28000 USDC
  const offerDeposit = new anchor.BN(56_000_000_000); // 56000 USDC

  before(async () => {
    // 初始化測試帳戶
    authority = Keypair.generate();
    feeReceiver = Keypair.generate();
    owner = Keypair.generate();
    applicant = Keypair.generate();

    // Airdrop SOL
    await connection.requestAirdrop(authority.publicKey, 10 * LAMPORTS_PER_SOL);
    await connection.requestAirdrop(feeReceiver.publicKey, 10 * LAMPORTS_PER_SOL);
    await connection.requestAirdrop(owner.publicKey, 10 * LAMPORTS_PER_SOL);
    await connection.requestAirdrop(applicant.publicKey, 10 * LAMPORTS_PER_SOL);
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 創建 USDC mint
    usdcMint = await createMint(
      connection,
      authority,
      authority.publicKey,
      null,
      6
    );

    // 計算 PDAs
    [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("platform")],
      program.programId
    );
  });

  it("初始化平台", async () => {
    const tx = await program.methods
      .initializePlatform(listFee, cFee, payFee)
      .accountsPartial({
        platform: platformPda,
        authority: authority.publicKey,
        feeReceiver: feeReceiver.publicKey,
        usdcMint: usdcMint,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const platform = await program.account.platform.fetch(platformPda);
    assert.equal(platform.authority.toBase58(), authority.publicKey.toBase58());
    assert.equal(platform.listFee.toNumber(), listFee.toNumber());
  });

  it("房東上架房源", async () => {
    // 創建房東 USDC 帳戶並鑄造
    const ownerUsdc = await createAssociatedTokenAccount(
      connection,
      owner,
      usdcMint,
      owner.publicKey
    );

    await mintTo(
      connection,
      owner,
      usdcMint,
      ownerUsdc,
      authority,
      100_000_000_000 // 100000 USDC
    );

    // 創建平台 USDC 帳戶
    const platUsdc = await createAssociatedTokenAccount(
      connection,
      feeReceiver,
      usdcMint,
      feeReceiver.publicKey
    );

    // 計算房源 PDA
    [listingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), attestPdaOwner.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .listProperty(
        attestPdaOwner,
        mRent,
        depMonths,
        "QmTestPropertyDetailsHash"
      )
      .accountsPartial({
        platform: platformPda,
        listing: listingPda,
        owner: owner.publicKey,
        ownerUsdc: ownerUsdc,
        platUsdc: platUsdc,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const listing = await program.account.propertyListing.fetch(listingPda);
    assert.equal(listing.owner.toBase58(), owner.publicKey.toBase58());
    assert.equal(listing.mRent.toNumber(), mRent.toNumber());
  });

  it("房客申請租房", async () => {
    // 計算申請 PDA
    [applicationPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("application"), listingPda.toBuffer(), applicant.publicKey.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .applyRental(
        attestPdaApplicant,
        offerRent,
        offerDeposit,
        "QmTestApplicationDetailsHash"
      )
      .accountsPartial({
        listing: listingPda,
        application: applicationPda,
        applicant: applicant.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([applicant])
      .rpc();

    const application = await program.account.rentalApplication.fetch(applicationPda);
    assert.equal(application.applicant.toBase58(), applicant.publicKey.toBase58());
    assert.equal(application.offerRent.toNumber(), offerRent.toNumber());
  });

  it("房東還價", async () => {
    const newRent = new anchor.BN(29_000_000_000); // 29000 USDC
    const newDeposit = new anchor.BN(58_000_000_000); // 58000 USDC

    const tx = await program.methods
      .counterOffer(
        newRent,
        newDeposit,
        "QmTestCounterOfferHash"
      )
      .accountsPartial({
        listing: listingPda,
        application: applicationPda,
        owner: owner.publicKey,
      })
      .signers([owner])
      .rpc();

    const application = await program.account.rentalApplication.fetch(applicationPda);
    assert.equal(application.offerRent.toNumber(), newRent.toNumber());
    assert.equal(application.counter, 1);
  });

  it("房客再還價", async () => {
    const finalRent = new anchor.BN(28_500_000_000); // 28500 USDC
    const finalDeposit = new anchor.BN(57_000_000_000); // 57000 USDC

    const tx = await program.methods
      .counterOffer(
        finalRent,
        finalDeposit,
        "QmTestFinalOfferHash"
      )
      .accountsPartial({
        listing: listingPda,
        application: applicationPda,
        owner: applicant.publicKey,
      })
      .signers([applicant])
      .rpc();

    const application = await program.account.rentalApplication.fetch(applicationPda);
    assert.equal(application.offerRent.toNumber(), finalRent.toNumber());
    assert.equal(application.counter, 2);
  });

  it("房東接受申請", async () => {
    const tx = await program.methods
      .acceptApplication()
      .accountsPartial({
        listing: listingPda,
        application: applicationPda,
        owner: owner.publicKey,
      })
      .signers([owner])
      .rpc();

    const application = await program.account.rentalApplication.fetch(applicationPda);
    assert.equal(application.status.accepted !== undefined, true);
  });

  it("創建合約", async () => {
    // 計算合約和託管 PDA
    [contractPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("contract"), listingPda.toBuffer(), applicant.publicKey.toBuffer()],
      program.programId
    );

    [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), contractPda.toBuffer()],
      program.programId
    );

    const currentTime = Math.floor(Date.now() / 1000);
    const startDate = currentTime + 86400; // 明天開始
    const endDate = startDate + (365 * 86400); // 一年合約

    const tx = await program.methods
      .createContract(
        new anchor.BN(startDate),
        new anchor.BN(endDate),
        5, // 每月5號付款
        "QmTestContractHash"
      )
      .accountsPartial({
        listing: listingPda,
        application: applicationPda,
        contract: contractPda,
        escrow: escrowPda,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const contract = await program.account.rentalContract.fetch(contractPda);
    const application = await program.account.rentalApplication.fetch(applicationPda);
    assert.equal(contract.mRent.toNumber(), application.offerRent.toNumber());
    assert.equal(contract.deposit.toNumber(), application.offerDeposit.toNumber());
  });

  it("房客簽約並支付", async () => {
    // 創建房客 USDC 帳戶並鑄造
    const tUsdc = await createAssociatedTokenAccount(
      connection,
      applicant,
      usdcMint,
      applicant.publicKey
    );

    await mintTo(
      connection,
      applicant,
      usdcMint,
      tUsdc,
      authority,
      200_000_000_000 // 200000 USDC
    );

    // 獲取房東 USDC 帳戶地址（已存在）
    const lUsdc = await getAssociatedTokenAddress(
      usdcMint,
      owner.publicKey
    );

    // 創建託管帳戶（使用 Keypair）
    escrowUsdcKeypair = Keypair.generate();
    await createAccount(
      connection,
      applicant, // payer
      usdcMint,
      escrowPda, // owner 是 escrow PDA
      escrowUsdcKeypair
    );

    // 獲取平台 USDC 帳戶地址
    const platUsdc = await getAssociatedTokenAddress(
      usdcMint,
      feeReceiver.publicKey
    );

    // 計算支付記錄 PDA
    const [paymentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("payment"), contractPda.toBuffer(), Buffer.from("initial")],
      program.programId
    );

    const tx = await program.methods
      .signContract()
      .accountsPartial({
        platform: platformPda,
        listing: listingPda,
        contract: contractPda,
        tenant: applicant.publicKey,
        tUsdc: tUsdc,
        lUsdc: lUsdc,
        escrowUsdc: escrowUsdcKeypair.publicKey,
        escrowPda: escrowPda,
        platUsdc: platUsdc,
        paymentRecord: paymentPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([applicant])
      .rpc();

    const contract = await program.account.rentalContract.fetch(contractPda);
    assert.equal(contract.status.active !== undefined, true);
    assert.equal(contract.paidM, 1);
    
    // 驗證託管帳戶
    const escrowTokenAccount = await getAccount(connection, escrowUsdcKeypair.publicKey);
    console.log("託管帳戶餘額:", escrowTokenAccount.amount.toString());
    console.log("託管帳戶 owner:", escrowTokenAccount.owner.toString());
    console.log("預期的 escrow PDA:", escrowPda.toString());
    assert.equal(escrowTokenAccount.amount.toString(), contract.deposit.toString());
    assert.equal(escrowTokenAccount.owner.toString(), escrowPda.toString());
  });

  it.skip("房客支付月租", async () => {
    const tUsdc = await getAssociatedTokenAddress(
      usdcMint,
      applicant.publicKey
    );

    const lUsdc = await getAssociatedTokenAddress(
      usdcMint,
      owner.publicKey
    );

    const platUsdc = await getAssociatedTokenAddress(
      usdcMint,
      feeReceiver.publicKey
    );

    const payMonth = "2024-02";
    const [paymentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("payment"), contractPda.toBuffer(), Buffer.from(payMonth)],
      program.programId
    );

    const tx = await program.methods
      .payRent(payMonth)
      .accountsPartial({
        platform: platformPda,
        contract: contractPda,
        tenant: applicant.publicKey,
        tUsdc: tUsdc,
        lUsdc: lUsdc,
        platUsdc: platUsdc,
        paymentRecord: paymentPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([applicant])
      .rpc();

    const contract = await program.account.rentalContract.fetch(contractPda);
    assert.equal(contract.paidM, 2);
  });

  it("報告爭議", async () => {
    const [disputePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("dispute"), contractPda.toBuffer(), applicant.publicKey.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .reportDispute(
        "設備損壞未修",
        "QmTestEvidenceHash"
      )
      .accountsPartial({
        contract: contractPda,
        dispute: disputePda,
        initiator: applicant.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([applicant])
      .rpc();

    const dispute = await program.account.disputeRecord.fetch(disputePda);
    assert.equal(dispute.initiator.toBase58(), applicant.publicKey.toBase58());
    assert.equal(dispute.status.open !== undefined, true);
  });

  it("終止合約", async () => {
    const tUsdc = await getAssociatedTokenAddress(
      usdcMint,
      applicant.publicKey
    );

    const [refundPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("payment"), contractPda.toBuffer(), Buffer.from("refund")],
      program.programId
    );

    // 驗證託管帳戶
    const escrowTokenAccount = await getAccount(connection, escrowUsdcKeypair.publicKey);
    console.log("退款前託管帳戶餘額:", escrowTokenAccount.amount.toString());
    console.log("託管帳戶 owner:", escrowTokenAccount.owner.toString());
    console.log("Escrow PDA:", escrowPda.toString());
    
    // 驗證 owner 是否正確
    if (escrowTokenAccount.owner.toString() !== escrowPda.toString()) {
      console.error("錯誤：託管帳戶的 owner 不是 escrow PDA!");
    }
    
    // 獲取 escrow 帳戶資訊
    const escrowAccount = await program.account.escrowAccount.fetch(escrowPda);
    console.log("Escrow bump:", escrowAccount.bump);
    
    // 重新計算 escrow PDA 和 bump
    const [recalculatedEscrowPda, recalculatedBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), contractPda.toBuffer()],
      program.programId
    );
    console.log("重新計算的 Escrow PDA:", recalculatedEscrowPda.toString());
    console.log("重新計算的 bump:", recalculatedBump);

    const tx = await program.methods
      .terminateContract("租約到期")
      .accountsPartial({
        listing: listingPda,
        contract: contractPda,
        escrow: escrowPda,
        signer: owner.publicKey,
        escrowUsdc: escrowUsdcKeypair.publicKey,
        tUsdc: tUsdc,
        refundRecord: refundPda,
        escrowPda: escrowPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const listing = await program.account.propertyListing.fetch(listingPda);
    assert.equal(listing.status.available !== undefined, true);
  });
});
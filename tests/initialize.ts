import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Zuvi } from "../target/types/zuvi";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import bs58 from "bs58";

async function initialize() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Zuvi as Program<Zuvi>;
  
  // API Signer
  const apiSignerKeypair = Keypair.fromSecretKey(
    bs58.decode("4K2Qa6nigxoESygxATeCX45L1HfPg4FoWau696CwvbX8KNCsNo4forbwiipHTXmiyEt6vzGXdghm5UUnREFJ2AGs")
  );
  
  // USDC Mint
  const usdcMint = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
  
  // 費率 0.4% = 40 basis points
  const feeRate = 40;
  
  // 衍生 Config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );
  
  // 檢查是否已初始化
  try {
    const config = await program.account.config.fetch(configPda);
    console.log("系統已初始化");
    console.log("Config:", {
      apiSigner: config.apiSigner.toString(),
      arbitrator: config.arbitrator.toString(),
      feeReceiver: config.feeReceiver.toString(),
      usdcMint: config.usdcMint.toString(),
      feeRate: config.feeRate,
      initialized: config.initialized
    });
    return;
  } catch {
    console.log("系統未初始化，開始初始化...");
  }
  
  try {
    const tx = await program.methods
      .initialize(
        apiSignerKeypair.publicKey,
        apiSignerKeypair.publicKey,  // 仲裁者也用同一個
        apiSignerKeypair.publicKey,  // 費用接收者也用同一個
        usdcMint,
        feeRate
      )
      .accountsStrict({
        config: configPda,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log("初始化成功");
    console.log("Transaction:", tx);
    console.log("Config PDA:", configPda.toString());
    
    // 驗證初始化
    const config = await program.account.config.fetch(configPda);
    console.log("Config:", {
      apiSigner: config.apiSigner.toString(),
      arbitrator: config.arbitrator.toString(),
      feeReceiver: config.feeReceiver.toString(),
      usdcMint: config.usdcMint.toString(),
      feeRate: config.feeRate,
      initialized: config.initialized
    });
    
  } catch (error) {
    console.error("初始化失敗:", error);
  }
}

initialize();
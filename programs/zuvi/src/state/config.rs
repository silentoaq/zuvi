use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub authority: Pubkey,     // 管理權限
    pub api_signer: Pubkey,    // API Server 簽名者
    pub arbitrator: Pubkey,    // 仲裁者
    pub fee_receiver: Pubkey,  // 平台費接收帳戶
    pub fee_rate: u16,         // 平台費率 (basis points)
    pub usdc_mint: Pubkey,     // USDC SPL Token Mint
    pub initialized: bool,     // 是否已初始化
}

impl Config {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        32 + // api_signer
        32 + // arbitrator
        32 + // fee_receiver
        2 +  // fee_rate
        32 + // usdc_mint
        1;   // initialized
        
    pub const SEED: &'static [u8] = b"config";
}
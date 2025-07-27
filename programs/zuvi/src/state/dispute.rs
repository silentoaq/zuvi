use anchor_lang::prelude::*;

#[account]
pub struct Dispute {
    pub lease: Pubkey,
    pub initiator: Pubkey,          // 發起方
    pub reason: u8,                 // 爭議類型 (0:押金, 1:損壞, 2:其他)
    pub status: u8,                 // 0:pending, 1:resolved
    pub resolution: Option<String>, // 仲裁結果簡述
    pub deposit_distribution: Option<(u64, u64)>, // (給房東, 給承租人)
    pub created_at: i64,
    pub resolved_at: Option<i64>,
}

impl Dispute {
    pub const LEN: usize = 8 + // discriminator
        32 +     // lease
        32 +     // initiator
        1 +      // reason
        1 +      // status
        1 + 4 + 128 + // resolution (Option<String>: 1 byte + 4 bytes len + content)
        1 + 16 +  // deposit_distribution (Option<(u64, u64)>: 1 byte + 16 bytes)
        8 +      // created_at
        1 + 8;   // resolved_at (Option<i64>: 1 byte + 8 bytes)
        
    pub const SEED: &'static [u8] = b"dispute";
}
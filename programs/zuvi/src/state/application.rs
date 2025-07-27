use anchor_lang::prelude::*;

#[account]
pub struct Application {
    pub listing: Pubkey,
    pub applicant: Pubkey,
    pub tenant_attest: Pubkey,
    pub message: String,        // 自我介紹
    pub status: u8,             // 0:pending, 1:approved, 2:rejected, 3:expired
    pub created_at: i64,
}

impl Application {
    pub const LEN: usize = 8 + // discriminator
        32 +     // listing
        32 +     // applicant
        32 +     // tenant_attest
        4 + 256 + // message (String: 4 bytes len + content)
        1 +      // status
        8;       // created_at
        
    pub const SEED: &'static [u8] = b"apply";
}
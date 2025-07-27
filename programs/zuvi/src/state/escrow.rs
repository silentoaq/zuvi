use anchor_lang::prelude::*;

#[account]
pub struct Escrow {
    pub lease: Pubkey,
    pub amount: u64,                // 押金總額
    pub deducted: u64,              // 已扣除金額
    pub status: u8,                 // 0:holding, 1:settling, 2:settled
    pub has_dispute: bool,          // 是否有未解決爭議
    pub settle_request: Option<SettleRequest>, // 結算請求
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SettleRequest {
    pub initiator: Pubkey,          // 發起方（房東）
    pub total_deductions: u64,      // 總扣款金額
    pub deduction_count: u8,        // 扣款項目數量（改為簡化版本）
    pub created_at: i64,
    pub tenant_confirmed: bool,     // 承租人確認
}

impl Escrow {
    pub const LEN: usize = 8 + // discriminator
        32 +    // lease
        8 +     // amount
        8 +     // deducted
        1 +     // status
        1 +     // has_dispute
        1 +     // settle_request option flag
        32 +    // initiator
        8 +     // total_deductions
        1 +     // deduction_count
        8 +     // created_at
        1 +     // tenant_confirmed
        64;     // 預留空間
        
    pub const SEED: &'static [u8] = b"esc";
}
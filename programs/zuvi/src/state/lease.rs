use anchor_lang::prelude::*;

#[account]
pub struct Lease {
    pub listing: Pubkey,
    pub landlord: Pubkey,
    pub tenant: Pubkey,
    pub tenant_attest: Pubkey,
    
    pub start_date: i64,
    pub end_date: i64,
    pub rent: u64,
    pub deposit_paid: u64,
    pub deposit_deducted: u64,
    
    pub payment_day: u8,            // 每月繳費日 (1-28)
    pub grace_days: u8,             // 寬限天數（從 listing 複製）
    
    // 支付記錄（整合 Payment 功能）
    pub total_payments: u32,        // 總期數
    pub paid_payments: u32,         // 已支付期數
    pub last_payment_date: i64,     // 最後支付日期
    pub last_payment_index: u32,    // 最後支付期數
    pub overdue_count: u8,          // 逾期次數（累積制）
    pub next_due_date: i64,         // 下次到期日
    
    pub dispute_count: u32,         // 爭議計數（用於生成ID）
    pub status: u8,                 // 0:active, 1:completed, 2:terminated
    pub termination_reason: Option<u8>, // 終止原因
    pub created_at: i64,
    pub updated_at: i64,
}

impl Lease {
    pub const LEN: usize = 8 + // discriminator
        32 +    // listing
        32 +    // landlord
        32 +    // tenant
        32 +    // tenant_attest
        8 +     // start_date
        8 +     // end_date
        8 +     // rent
        8 +     // deposit_paid
        8 +     // deposit_deducted
        1 +     // payment_day
        1 +     // grace_days
        4 +     // total_payments
        4 +     // paid_payments
        8 +     // last_payment_date
        4 +     // last_payment_index
        1 +     // overdue_count
        8 +     // next_due_date
        4 +     // dispute_count
        1 +     // status
        1 + 1 + // termination_reason (Option<u8>: 1 byte flag + 1 byte value)
        8 +     // created_at
        8;      // updated_at
        
    pub const SEED: &'static [u8] = b"lease";
}
use anchor_lang::prelude::*;

// 平台帳戶
#[account]
pub struct Platform {
    pub authority: Pubkey,
    pub fee_receiver: Pubkey,
    pub usdc_mint: Pubkey,
    pub listing_fee: u64,
    pub contract_fee: u64,
    pub payment_fee: u64,
    pub is_initialized: bool,
    pub total_fees_collected: u64,
    pub bump: u8,
}

impl Platform {
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 8 + 1 + 16;
}

// 房源列表
#[account]
pub struct PropertyListing {
    pub owner: Pubkey,
    pub property_id: String,         // 32
    pub owner_attestation: String,   // 128
    pub monthly_rent: u64,
    pub deposit_months: u8,
    pub property_details_hash: String, // 64
    pub current_contract: Option<Pubkey>,
    pub status: ListingStatus,
    pub created_at: i64,
    pub bump: u8,
}

impl PropertyListing {
    pub const SIZE: usize = 8 + 32 + 64 + 128 + 8 + 1 + 64 + 33 + 1 + 8 + 1 + 32;
}

// 租房申請
#[account]
pub struct RentalApplication {
    pub listing: Pubkey,
    pub applicant: Pubkey,
    pub applicant_attestation: String, // 128
    pub proposed_terms: String,        // 256
    pub status: ApplicationStatus,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl RentalApplication {
    pub const SIZE: usize = 8 + 32 + 32 + 128 + 256 + 1 + 8 + 8 + 1 + 32;
}

// 租賃合約
#[account]
pub struct RentalContract {
    pub listing: Pubkey,
    pub landlord: Pubkey,
    pub tenant: Pubkey,
    pub monthly_rent: u64,
    pub deposit_amount: u64,
    pub start_date: i64,
    pub end_date: i64,
    pub payment_day: u8,
    pub contract_hash: String, // 64
    pub escrow_account: Pubkey,
    pub status: ContractStatus,
    pub paid_months: u16,
    pub created_at: i64,
    pub bump: u8,
}

impl RentalContract {
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 64 + 32 + 1 + 2 + 8 + 1 + 32;
}

// 支付記錄
#[account]
pub struct PaymentRecord {
    pub contract: Pubkey,
    pub payer: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub payment_type: PaymentType,
    pub payment_month: Option<String>, // 20
    pub timestamp: i64,
    pub bump: u8,
}

impl PaymentRecord {
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 8 + 1 + 24 + 8 + 1 + 16;
}

// 託管帳戶
#[account]
pub struct EscrowAccount {
    pub contract: Pubkey,
    pub deposit_amount: u64,
    pub deposit_refunded: bool,
    pub bump: u8,
}

impl EscrowAccount {
    pub const SIZE: usize = 8 + 32 + 8 + 1 + 1 + 16;
}

// 爭議記錄
#[account]
pub struct DisputeRecord {
    pub dispute_id: Pubkey,
    pub contract: Pubkey,
    pub initiated_by: Pubkey,
    pub respondent: Pubkey,
    pub reason: String,                      // 256
    pub evidence_hash: String,               // 64
    pub status: DisputeStatus,
    pub created_at: i64,
    pub updated_at: i64,
    pub resolution_notes: Option<String>,    // 256
    pub bump: u8,
}

impl DisputeRecord {
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 32 + 256 + 64 + 1 + 8 + 8 + 256 + 1 + 32;
}

// 枚舉類型
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ListingStatus {
    Available,
    Rented,
    Delisted,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ApplicationStatus {
    Pending,
    Accepted,
    Rejected,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ContractStatus {
    PendingSignature,
    Active,
    Completed,
    Terminated,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PaymentType {
    Deposit,
    FirstMonthRent,
    MonthlyRent,
    PlatformFee,
    DepositRefund,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum DisputeStatus {
    Open,
    UnderReview,
    Resolved,
    Withdrawn,
}
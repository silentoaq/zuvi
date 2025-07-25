use anchor_lang::prelude::*;

#[account]
pub struct Platform {
    pub authority: Pubkey,
    pub fee_receiver: Pubkey,
    pub usdc_mint: Pubkey,
    pub list_fee: u64,
    pub c_fee: u64,
    pub pay_fee: u64,
    pub is_initialized: bool,
    pub total_fees: u64,
    pub bump: u8,
}

impl Platform {
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 8 + 1 + 16;
}

#[account]
pub struct PropertyListing {
    pub owner: Pubkey,
    pub attest_pda: Pubkey,          // twattest PDA
    pub m_rent: u64,                 // 月租金
    pub dep_months: u8,              // 押金月數
    pub details: String,             // 64 chars - IPFS hash
    pub cur_contract: Option<Pubkey>,
    pub status: ListingStatus,
    pub created: i64,
    pub bump: u8,
}

impl PropertyListing {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 1 + 64 + 33 + 1 + 8 + 1 + 32;
}

#[account]
pub struct RentalApplication {
    pub listing: Pubkey,
    pub applicant: Pubkey,
    pub attest_pda: Pubkey,          // twattest PDA
    pub offer_rent: u64,             // 提議租金
    pub offer_deposit: u64,          // 提議押金
    pub offer_hash: String,          // 64 chars - IPFS 完整提案
    pub counter: u8,                 // 協商次數
    pub last_actor: Pubkey,          // 最後提案方
    pub status: ApplicationStatus,
    pub created: i64,
    pub updated: i64,
    pub bump: u8,
}

impl RentalApplication {
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 64 + 1 + 32 + 1 + 8 + 8 + 1 + 32;
}

#[account]
pub struct RentalContract {
    pub listing: Pubkey,
    pub landlord: Pubkey,
    pub tenant: Pubkey,
    pub m_rent: u64,
    pub deposit: u64,
    pub start: i64,
    pub end: i64,
    pub pay_day: u8,
    pub c_hash: String,              // 64 chars - IPFS hash
    pub escrow: Pubkey,
    pub status: ContractStatus,
    pub paid_m: u16,
    pub created: i64,
    pub bump: u8,
}

impl RentalContract {
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 64 + 32 + 1 + 2 + 8 + 1 + 32;
}

#[account]
pub struct PaymentRecord {
    pub contract: Pubkey,
    pub payer: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub pay_type: PaymentType,
    pub pay_month: Option<String>,   // 20 chars
    pub tx_time: i64,
    pub bump: u8,
}

impl PaymentRecord {
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 8 + 1 + 24 + 8 + 1 + 16;
}

#[account]
pub struct EscrowAccount {
    pub contract: Pubkey,
    pub deposit: u64,
    pub refunded: bool,
    pub bump: u8,
}

impl EscrowAccount {
    pub const SIZE: usize = 8 + 32 + 8 + 1 + 1 + 16;
}

#[account]
pub struct DisputeRecord {
    pub id: Pubkey,
    pub contract: Pubkey,
    pub initiator: Pubkey,
    pub respondent: Pubkey,
    pub reason: String,              // 256 chars
    pub e_hash: String,              // 64 chars - IPFS hash
    pub status: DisputeStatus,
    pub created: i64,
    pub updated: i64,
    pub notes: Option<String>,       // 256 chars
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
    Negotiating,
    Accepted,
    Rejected,
    Expired,
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
use anchor_lang::prelude::*;

// Platform
#[account]
pub struct Platform {
    pub authority: Pubkey,
    pub fee_receiver: Pubkey,
    pub usdc_mint: Pubkey,
    pub listing_fee: u64,
    pub contract_fee: u64,
    pub payment_fee: u64,
    pub total_fees_collected: u64,
    pub is_initialized: bool,
    pub bump: u8,
}

impl Platform {
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 16;
}

// Listing Status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ListingStatus {
    Available,
    Rented,
    Delisted,
}

// Property Listing
#[account]
pub struct PropertyListing {
    pub property_id: String,
    pub owner: Pubkey,
    pub owner_attestation: String,
    pub monthly_rent: u64,
    pub deposit_months: u8,
    pub property_details_hash: String,
    pub status: ListingStatus,
    pub current_tenant: Option<Pubkey>,
    pub current_contract: Option<Pubkey>,
    pub created_at: i64,
    pub bump: u8,
}

impl PropertyListing {
    pub const SIZE: usize = 8 + 64 + 32 + 128 + 8 + 1 + 64 + 1 + 33 + 33 + 8 + 1 + 64;
}

// Application Status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ApplicationStatus {
    Pending,
    Accepted,
    Rejected,
    Cancelled,
}

// Rental Application
#[account]
pub struct RentalApplication {
    pub listing: Pubkey,
    pub applicant: Pubkey,
    pub applicant_attestation: String,
    pub proposed_terms: String,
    pub status: ApplicationStatus,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl RentalApplication {
    pub const SIZE: usize = 8 + 32 + 32 + 128 + 256 + 1 + 8 + 8 + 1 + 32;
}

// Contract Status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ContractStatus {
    PendingSignature,
    Active,
    Terminated,
    Completed,
}

// Rental Contract
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
    pub contract_hash: String,
    pub escrow_account: Pubkey,
    pub status: ContractStatus,
    pub paid_months: u16,
    pub created_at: i64,
    pub bump: u8,
}

impl RentalContract {
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 64 + 32 + 1 + 2 + 8 + 1 + 32;
}

// Payment Type
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PaymentType {
    Deposit,
    FirstMonth,
    MonthlyRent,
    DepositRefund,
}

// Payment Record
#[account]
pub struct PaymentRecord {
    pub contract: Pubkey,
    pub payment_type: PaymentType,
    pub amount: u64,
    pub payer: Pubkey,
    pub receiver: Pubkey,
    pub payment_month: Option<String>,
    pub paid_at: i64,
    pub transaction_signature: String,
    pub bump: u8,
}

impl PaymentRecord {
    pub const SIZE: usize = 8 + 32 + 1 + 8 + 32 + 32 + 20 + 8 + 88 + 1 + 32;
}

// Escrow Account
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

// Dispute Status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum DisputeStatus {
    Open,
    UnderReview,
    Resolved,
    Withdrawn,
}

// Dispute Record
#[account]
pub struct DisputeRecord {
    pub dispute_id: Pubkey,
    pub contract: Pubkey,
    pub initiated_by: Pubkey,
    pub respondent: Pubkey,
    pub reason: String,
    pub evidence_hash: String,
    pub status: DisputeStatus,
    pub created_at: i64,
    pub updated_at: i64,
    pub resolution_notes: Option<String>,
    pub bump: u8,
}

impl DisputeRecord {
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 32 + 256 + 64 + 1 + 8 + 8 + 256 + 1 + 32;
}

// Events
#[event]
pub struct PropertyListed {
    pub listing: Pubkey,
    pub owner: Pubkey,
    pub property_id: String,
    pub monthly_rent: u64,
    pub timestamp: i64,
}

#[event]
pub struct ContractSigned {
    pub contract: Pubkey,
    pub landlord: Pubkey,
    pub tenant: Pubkey,
    pub total_payment: u64,
    pub timestamp: i64,
}

#[event]
pub struct RentPaid {
    pub contract: Pubkey,
    pub tenant: Pubkey,
    pub amount: u64,
    pub payment_month: String,
    pub timestamp: i64,
}

#[event]
pub struct DisputeRaised {
    pub dispute_id: Pubkey,
    pub contract: Pubkey,
    pub initiated_by: Pubkey,
    pub reason: String,
    pub timestamp: i64,
}

#[event]
pub struct DisputeResolved {
    pub dispute_id: Pubkey,
    pub status: DisputeStatus,
    pub timestamp: i64,
}
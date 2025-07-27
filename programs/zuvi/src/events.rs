use anchor_lang::prelude::*;

// 系統事件
#[event]
pub struct ConfigUpdated {
    pub updater: Pubkey,
    pub api_signer: Option<Pubkey>,
    pub arbitrator: Option<Pubkey>,
    pub fee_receiver: Option<Pubkey>,
    pub fee_rate: Option<u16>,
}

// 房源事件
#[event]
pub struct ListingCreated {
    pub listing: Pubkey,
    pub owner: Pubkey,
    pub property_attest: Pubkey,
    pub rent: u64,
}

#[event]
pub struct ListingUpdated {
    pub listing: Pubkey,
    pub rent: u64,
    pub status: u8,
}

// 申請事件
#[event]
pub struct ApplicationSubmitted {
    pub application: Pubkey,
    pub listing: Pubkey,
    pub applicant: Pubkey,
}

#[event]
pub struct ApplicationApproved {
    pub application: Pubkey,
    pub listing: Pubkey,
    pub tenant: Pubkey,
}

#[event]
pub struct ApplicationRejected {
    pub application: Pubkey,
    pub listing: Pubkey,
    pub applicant: Pubkey,
}

// 租賃事件
#[event]
pub struct LeaseCreated {
    pub lease: Pubkey,
    pub listing: Pubkey,
    pub landlord: Pubkey,
    pub tenant: Pubkey,
    pub start_date: i64,
    pub end_date: i64,
    pub payment_day: u8,
}

#[event]
pub struct RentPaid {
    pub lease: Pubkey,
    pub payment_index: u32,
    pub amount: u64,
    pub paid_date: i64,
}

#[event]
pub struct RentOverdue {
    pub lease: Pubkey,
    pub payment_index: u32,
    pub overdue_count: u8,
}

#[event]
pub struct LeaseTerminated {
    pub lease: Pubkey,
    pub reason: u8,
    pub terminator: Pubkey,
}

// 結算事件
#[event]
pub struct SettleRequested {
    pub escrow: Pubkey,
    pub lease: Pubkey,
    pub total_deductions: u64,
}

#[event]
pub struct SettleConfirmed {
    pub escrow: Pubkey,
    pub lease: Pubkey,
    pub landlord_amount: u64,
    pub tenant_amount: u64,
}

// 爭議事件
#[event]
pub struct DisputeCreated {
    pub dispute: Pubkey,
    pub lease: Pubkey,
    pub initiator: Pubkey,
    pub reason: u8,
}

#[event]
pub struct DisputeResolved {
    pub dispute: Pubkey,
    pub resolution: String,
    pub landlord_amount: u64,
    pub tenant_amount: u64,
}
use anchor_lang::prelude::*;

#[event]
pub struct ListingCreated {
    pub listing: Pubkey,
    pub owner: Pubkey,
    pub property_attest: Pubkey,
    pub rent: u64,
    pub deposit: u64,
    pub created_at: i64,
}

#[event]
pub struct ListingUpdated {
    pub listing: Pubkey,
    pub owner: Pubkey,
    pub rent: Option<u64>,
    pub deposit: Option<u64>,
    pub metadata_updated: bool,
}

#[event]
pub struct ListingToggled {
    pub listing: Pubkey,
    pub owner: Pubkey,
    pub new_status: u8,
}

#[event]
pub struct ApplicationSubmitted {
    pub application: Pubkey,
    pub listing: Pubkey,
    pub applicant: Pubkey,
    pub tenant_attest: Pubkey,
    pub created_at: i64,
}

#[event]
pub struct ApplicationApproved {
    pub application: Pubkey,
    pub listing: Pubkey,
    pub applicant: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct ApplicationRejected {
    pub application: Pubkey,
    pub listing: Pubkey,
    pub applicant: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct ApplicationClosed {
    pub application: Pubkey,
    pub listing: Pubkey,
    pub applicant: Pubkey,
}

#[event]
pub struct ApplicationCancelled {
    pub application: Pubkey,
    pub listing: Pubkey,
    pub applicant: Pubkey,
    pub cancelled_by: Pubkey,
}

#[event]
pub struct LeaseCreated {
    pub lease: Pubkey,
    pub listing: Pubkey,
    pub landlord: Pubkey,
    pub tenant: Pubkey,
    pub start_date: i64,
    pub end_date: i64,
    pub rent: u64,
    pub deposit: u64,
}

#[event]
pub struct LeaseSigned {
    pub lease: Pubkey,
    pub listing: Pubkey,
    pub landlord: Pubkey,
    pub tenant: Pubkey,
    pub escrow: Pubkey,
    pub deposit_amount: u64,
    pub first_rent_paid: u64,
}

#[event]
pub struct RentPaid {
    pub lease: Pubkey,
    pub tenant: Pubkey,
    pub landlord: Pubkey,
    pub month: u32,
    pub amount: u64,
    pub platform_fee: u64,
    pub payment_date: i64,
}

#[event]
pub struct ReleaseInitiated {
    pub escrow: Pubkey,
    pub lease: Pubkey,
    pub initiator: Pubkey,
    pub landlord_amount: u64,
    pub tenant_amount: u64,
}

#[event]
pub struct ReleaseConfirmed {
    pub escrow: Pubkey,
    pub lease: Pubkey,
    pub listing: Pubkey,
    pub landlord: Pubkey,
    pub tenant: Pubkey,
    pub landlord_amount: u64,
    pub tenant_amount: u64,
}

#[event]
pub struct DisputeRaised {
    pub dispute: Pubkey,
    pub lease: Pubkey,
    pub escrow: Pubkey,
    pub initiator: Pubkey,
    pub reason: u8,
    pub created_at: i64,
}

#[event]
pub struct DisputeResolved {
    pub dispute: Pubkey,
    pub lease: Pubkey,
    pub listing: Pubkey,
    pub escrow: Pubkey,
    pub arbitrator: Pubkey,
    pub landlord_amount: u64,
    pub tenant_amount: u64,
}
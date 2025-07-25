use anchor_lang::prelude::*;
use crate::state::DisputeStatus;

#[event]
pub struct PropertyListed {
    pub listing: Pubkey,
    pub owner: Pubkey,
    pub property_id: String,
    pub m_rent: u64,
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
    pub pay_month: String,
    pub timestamp: i64,
}

#[event]
pub struct DisputeRaised {
    pub dispute_id: Pubkey,
    pub contract: Pubkey,
    pub initiator: Pubkey,
    pub reason: String,
    pub timestamp: i64,
}

#[event]
pub struct DisputeResolved {
    pub dispute_id: Pubkey,
    pub status: DisputeStatus,
    pub timestamp: i64,
}
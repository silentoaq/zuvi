use anchor_lang::prelude::*;
use crate::state::{RentalContract, DisputeRecord, DisputeStatus, ContractStatus};
use crate::errors::ZuviError;

#[derive(Accounts)]
pub struct ReportDispute<'info> {
    #[account(
        constraint = contract.status == ContractStatus::Active @ ZuviError::InvalidContractStatus,
        constraint = 
            contract.landlord == initiator.key() || 
            contract.tenant == initiator.key() 
            @ ZuviError::NotContractParty
    )]
    pub contract: Box<Account<'info, RentalContract>>,

    #[account(
        init,
        payer = initiator,
        space = DisputeRecord::SIZE,
        seeds = [b"dispute", contract.key().as_ref(), initiator.key().as_ref()],
        bump
    )]
    pub dispute: Box<Account<'info, DisputeRecord>>,

    #[account(mut)]
    pub initiator: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct RespondDispute<'info> {
    #[account(
        mut,
        constraint = dispute.respondent == respondent.key() @ ZuviError::NotContractParty,
        constraint = dispute.status == DisputeStatus::Open @ ZuviError::InvalidDisputeStatus
    )]
    pub dispute: Box<Account<'info, DisputeRecord>>,

    pub respondent: Signer<'info>,
    pub clock: Sysvar<'info, Clock>,
}
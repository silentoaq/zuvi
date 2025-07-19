use anchor_lang::prelude::*;
use crate::errors::ZuviError;
use crate::state::{RentalContract, DisputeRecord, DisputeStatus, ContractStatus, DisputeRaised};

#[derive(Accounts)]
pub struct ReportDispute<'info> {
    #[account(
        constraint = contract.status == ContractStatus::Active @ ZuviError::InvalidContractStatus,
        constraint = 
            contract.landlord == initiator.key() || 
            contract.tenant == initiator.key() 
            @ ZuviError::NotContractParty
    )]
    pub contract: Account<'info, RentalContract>,

    #[account(mut)]
    pub initiator: Signer<'info>,

    #[account(
        init,
        payer = initiator,
        space = DisputeRecord::SIZE,
        seeds = [b"dispute", contract.key().as_ref(), initiator.key().as_ref()],
        bump
    )]
    pub dispute_record: Account<'info, DisputeRecord>,

    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn report_dispute(
    ctx: Context<ReportDispute>,
    reason: String,
    evidence_hash: String,
) -> Result<()> {
    let contract = &ctx.accounts.contract;
    let dispute = &mut ctx.accounts.dispute_record;
    let clock = &ctx.accounts.clock;
    let initiator = ctx.accounts.initiator.key();

    require!(reason.len() <= 256, ZuviError::StringTooLong);
    require!(evidence_hash.len() <= 64, ZuviError::StringTooLong);

    let respondent = if contract.landlord == initiator {
        contract.tenant
    } else {
        contract.landlord
    };

    dispute.dispute_id = dispute.key();
    dispute.contract = contract.key();
    dispute.initiated_by = initiator;
    dispute.respondent = respondent;
    dispute.reason = reason.clone();
    dispute.evidence_hash = evidence_hash;
    dispute.status = DisputeStatus::Open;
    dispute.created_at = clock.unix_timestamp;
    dispute.updated_at = clock.unix_timestamp;
    dispute.resolution_notes = None;
    dispute.bump = ctx.bumps.dispute_record;

    msg!("Dispute raised successfully");
    msg!("Contract: {}", contract.key());
    msg!("Initiated by: {}", initiator);
    msg!("Reason: {}", reason);

    emit!(DisputeRaised {
        dispute_id: dispute.key(),
        contract: contract.key(),
        initiated_by: initiator,
        reason,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
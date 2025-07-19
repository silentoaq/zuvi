use anchor_lang::prelude::*;
use crate::errors::ZuviError;
use crate::state::{DisputeRecord, DisputeStatus};

#[derive(Accounts)]
pub struct RespondToDispute<'info> {
    #[account(
        mut,
        constraint = dispute_record.respondent == respondent.key() @ ZuviError::NotContractParty,
        constraint = dispute_record.status == DisputeStatus::Open @ ZuviError::InvalidDisputeStatus
    )]
    pub dispute_record: Account<'info, DisputeRecord>,

    pub respondent: Signer<'info>,

    pub clock: Sysvar<'info, Clock>,
}

pub fn respond_to_dispute(
    ctx: Context<RespondToDispute>,
    response_evidence_hash: String,
) -> Result<()> {
    let dispute = &mut ctx.accounts.dispute_record;
    let clock = &ctx.accounts.clock;

    require!(response_evidence_hash.len() <= 64, ZuviError::StringTooLong);

    dispute.status = DisputeStatus::UnderReview;
    dispute.updated_at = clock.unix_timestamp;
    dispute.evidence_hash = format!("{},{}", dispute.evidence_hash, response_evidence_hash);

    msg!("Response to dispute submitted");
    msg!("Dispute: {}", dispute.dispute_id);
    msg!("Response evidence: {}", response_evidence_hash);

    Ok(())
}
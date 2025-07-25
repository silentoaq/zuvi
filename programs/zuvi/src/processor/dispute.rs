use anchor_lang::prelude::*;
use crate::context::dispute::*;
use crate::state::DisputeStatus;
use crate::errors::ZuviError;
use crate::events::DisputeRaised;

pub fn report(
    ctx: Context<ReportDispute>,
    reason: String,
    e_hash: String,
) -> Result<()> {
    let contract = &ctx.accounts.contract;
    let dispute = &mut ctx.accounts.dispute;
    let clock = &ctx.accounts.clock;

    require!(reason.len() <= 256, ZuviError::StringTooLong);
    require!(e_hash.len() <= 64, ZuviError::StringTooLong);

    // 確定被告方
    let respondent = if contract.landlord == ctx.accounts.initiator.key() {
        contract.tenant
    } else {
        contract.landlord
    };

    dispute.id = dispute.key();
    dispute.contract = contract.key();
    dispute.initiator = ctx.accounts.initiator.key();
    dispute.respondent = respondent;
    dispute.reason = reason.clone();
    dispute.e_hash = e_hash;
    dispute.status = DisputeStatus::Open;
    dispute.created = clock.unix_timestamp;
    dispute.updated = clock.unix_timestamp;
    dispute.notes = None;
    
    let (_, bump) = Pubkey::find_program_address(
        &[b"dispute", contract.key().as_ref(), ctx.accounts.initiator.key().as_ref()],
        &crate::ID
    );
    dispute.bump = bump;

    emit!(DisputeRaised {
        dispute_id: dispute.key(),
        contract: contract.key(),
        initiator: ctx.accounts.initiator.key(),
        reason,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

pub fn respond(
    ctx: Context<RespondDispute>,
    r_hash: String,
) -> Result<()> {
    let dispute = &mut ctx.accounts.dispute;
    let clock = &ctx.accounts.clock;

    require!(r_hash.len() <= 64, ZuviError::StringTooLong);

    dispute.status = DisputeStatus::UnderReview;
    dispute.updated = clock.unix_timestamp;
    dispute.e_hash = format!("{},{}", dispute.e_hash, r_hash);

    Ok(())
}
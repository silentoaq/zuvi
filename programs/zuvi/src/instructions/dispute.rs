use anchor_lang::prelude::*;
use anchor_lang::emit;
use crate::errors::ZuviError;
use crate::state::{RentalContract, DisputeRecord, DisputeStatus, ContractStatus};
use crate::events::DisputeRaised;

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
    pub dispute_record: Box<Account<'info, DisputeRecord>>,

    #[account(mut)]
    pub initiator: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn report(
    ctx: Context<ReportDispute>,
    reason: String,
    evidence_hash: String,
) -> Result<()> {
    let contract = &*ctx.accounts.contract;
    let dispute = &mut *ctx.accounts.dispute_record;
    let clock = &ctx.accounts.clock;

    // 驗證
    require!(reason.len() <= 256, ZuviError::StringTooLong);
    require!(evidence_hash.len() <= 64, ZuviError::StringTooLong);

    // 確定被告方
    let respondent = if contract.landlord == ctx.accounts.initiator.key() {
        contract.tenant
    } else {
        contract.landlord
    };

    // 初始化爭議
    dispute.dispute_id = dispute.key();
    dispute.contract = contract.key();
    dispute.initiated_by = ctx.accounts.initiator.key();
    dispute.respondent = respondent;
    dispute.reason = reason.clone();
    dispute.evidence_hash = evidence_hash;
    dispute.status = DisputeStatus::Open;
    dispute.created_at = clock.unix_timestamp;
    dispute.updated_at = clock.unix_timestamp;
    dispute.resolution_notes = None;
    let (_, bump) = Pubkey::find_program_address(
        &[b"dispute", contract.key().as_ref(), ctx.accounts.initiator.key().as_ref()],
        &crate::ID
    );
    dispute.bump = bump;

    // 發送事件
    emit!(DisputeRaised {
        dispute_id: dispute.key(),
        contract: contract.key(),
        initiated_by: ctx.accounts.initiator.key(),
        reason,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct RespondToDispute<'info> {
    #[account(
        mut,
        constraint = dispute_record.respondent == respondent.key() @ ZuviError::NotContractParty,
        constraint = dispute_record.status == DisputeStatus::Open @ ZuviError::InvalidDisputeStatus
    )]
    pub dispute_record: Box<Account<'info, DisputeRecord>>,

    pub respondent: Signer<'info>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn respond(
    ctx: Context<RespondToDispute>,
    response_evidence_hash: String,
) -> Result<()> {
    let dispute = &mut *ctx.accounts.dispute_record;
    let clock = &ctx.accounts.clock;

    require!(response_evidence_hash.len() <= 64, ZuviError::StringTooLong);

    // 更新狀態
    dispute.status = DisputeStatus::UnderReview;
    dispute.updated_at = clock.unix_timestamp;
    dispute.evidence_hash = format!("{},{}", dispute.evidence_hash, response_evidence_hash);

    msg!("爭議回應已提交");

    Ok(())
}
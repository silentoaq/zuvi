use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, state::*};

pub fn raise_dispute(ctx: Context<RaiseDispute>, reason: u8) -> Result<()> {
    let lease = &ctx.accounts.lease;
    let escrow = &mut ctx.accounts.escrow;
    let dispute = &mut ctx.accounts.dispute;
    let initiator = &ctx.accounts.initiator;
    let clock = Clock::get()?;
    
    require!(
        initiator.key() == lease.landlord || initiator.key() == lease.tenant,
        ZuviError::Unauthorized
    );
    
    require!(
        reason == DISPUTE_REASON_DEPOSIT || reason == DISPUTE_REASON_OTHER,
        ZuviError::InvalidDisputeReason
    );
    
    require!(
        escrow.status != ESCROW_STATUS_RELEASED,
        ZuviError::DepositAlreadyReleased
    );
    
    dispute.lease = lease.key();
    dispute.initiator = initiator.key();
    dispute.reason = reason;
    dispute.status = DISPUTE_STATUS_OPEN;
    dispute.created_at = clock.unix_timestamp;
    
    escrow.has_dispute = true;
    
    msg!("爭議已發起");
    msg!("發起人: {}", initiator.key());
    msg!("原因: {}", if reason == DISPUTE_REASON_DEPOSIT { "押金爭議" } else { "其他" });
    
    Ok(())
}

#[derive(Accounts)]
pub struct RaiseDispute<'info> {
    #[account(
        seeds = [LEASE_SEED, lease.listing.as_ref(), lease.tenant.as_ref(), &lease.start_date.to_le_bytes()],
        bump
    )]
    pub lease: Account<'info, Lease>,
    
    #[account(
        mut,
        seeds = [ESCROW_SEED, lease.key().as_ref()],
        bump,
        constraint = escrow.lease == lease.key()
    )]
    pub escrow: Account<'info, Escrow>,
    
    #[account(
        init,
        payer = initiator,
        space = DISPUTE_SIZE,
        seeds = [DISPUTE_SEED, lease.key().as_ref()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,
    
    #[account(mut)]
    pub initiator: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}
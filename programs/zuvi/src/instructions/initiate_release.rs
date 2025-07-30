use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, state::*};

pub fn initiate_release(
    ctx: Context<InitiateRelease>,
    landlord_amount: u64,
    tenant_amount: u64,
) -> Result<()> {
    let lease = &ctx.accounts.lease;
    let escrow = &mut ctx.accounts.escrow;
    let signer = &ctx.accounts.signer;
    
    require!(
        signer.key() == lease.landlord || signer.key() == lease.tenant,
        ZuviError::Unauthorized
    );
    
    require!(
        escrow.status == ESCROW_STATUS_HOLDING,
        ZuviError::DepositAlreadyReleased
    );
    
    require!(
        !escrow.has_dispute,
        ZuviError::DisputeInProgress
    );
    
    let total = landlord_amount + tenant_amount;
    require!(
        total == escrow.amount,
        ZuviError::AmountMismatch
    );
    
    escrow.status = ESCROW_STATUS_RELEASING;
    escrow.release_to_landlord = landlord_amount;
    escrow.release_to_tenant = tenant_amount;
    
    if signer.key() == lease.landlord {
        escrow.landlord_signed = true;
        escrow.tenant_signed = false;
    } else {
        escrow.landlord_signed = false;
        escrow.tenant_signed = true;
    }
    
    msg!("押金結算已發起");
    msg!("房東分配: {} USDC", landlord_amount);
    msg!("承租人分配: {} USDC", tenant_amount);
    msg!("等待另一方確認");
    
    Ok(())
}

#[derive(Accounts)]
pub struct InitiateRelease<'info> {
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
    
    pub signer: Signer<'info>,
}
use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, state::*};

pub fn reject_application(
    ctx: Context<RejectApplication>,
    applicant: Pubkey,
    _created_at: i64,
) -> Result<()> {
    let listing = &ctx.accounts.listing;
    let application = &mut ctx.accounts.application;
    
    require!(
        listing.owner == ctx.accounts.owner.key(),
        ZuviError::Unauthorized
    );
    
    require!(
        application.status == APPLICATION_STATUS_PENDING,
        ZuviError::InvalidApplication
    );
    
    require!(
        application.applicant == applicant,
        ZuviError::InvalidParameter
    );
    
    application.status = APPLICATION_STATUS_REJECTED;
    
    msg!("申請已拒絕");
    msg!("申請人: {}", applicant);
    msg!("房源: {}", listing.key());
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(applicant: Pubkey, _created_at: i64)]
pub struct RejectApplication<'info> {
    #[account(
        seeds = [LISTING_SEED, listing.property_attest.as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    
    #[account(
        mut,
        seeds = [APPLICATION_SEED, listing.key().as_ref(), applicant.as_ref(), &_created_at.to_le_bytes()],
        bump,
        constraint = application.listing == listing.key()
    )]
    pub application: Account<'info, Application>,
    
    pub owner: Signer<'info>,
}
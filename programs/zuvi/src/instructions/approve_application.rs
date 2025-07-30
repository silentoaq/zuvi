use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, state::*};

pub fn approve_application(
    ctx: Context<ApproveApplication>,
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
    
    require!(
        listing.status == LISTING_STATUS_AVAILABLE,
        ZuviError::ListingInactive
    );
    
    application.status = APPLICATION_STATUS_APPROVED;
    
    msg!("申請已核准");
    msg!("申請人: {}", applicant);
    msg!("房源: {}", listing.key());
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(applicant: Pubkey, _created_at: i64)]
pub struct ApproveApplication<'info> {
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
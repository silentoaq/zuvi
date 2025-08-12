use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, events::*, state::*};

pub fn cancel_approved_application(ctx: Context<CancelApprovedApplication>, _applicant: Pubkey, _created_at: i64) -> Result<()> {
    let listing = &mut ctx.accounts.listing;
    let application = &mut ctx.accounts.application;
    let signer = &ctx.accounts.signer;
    
    require!(
        application.applicant == signer.key() || listing.owner == signer.key(),
        ZuviError::Unauthorized
    );
    
    require!(
        application.status == APPLICATION_STATUS_APPROVED,
        ZuviError::InvalidApplication
    );
    
    require!(
        !listing.has_active_lease,
        ZuviError::LeaseAlreadyExists
    );
    
    application.status = APPLICATION_STATUS_REJECTED;
    listing.has_approved_application = false;
    
    emit!(ApplicationCancelled {
        application: application.key(),
        listing: listing.key(),
        applicant: application.applicant,
        cancelled_by: signer.key(),
    });
    
    msg!("已核准申請已取消");
    msg!("申請人: {}", application.applicant);
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(_applicant: Pubkey, _created_at: i64)]
pub struct CancelApprovedApplication<'info> {
    #[account(
        mut,
        seeds = [LISTING_SEED, listing.property_attest.as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    
    #[account(
        mut,
        seeds = [APPLICATION_SEED, application.listing.as_ref(), _applicant.as_ref(), &_created_at.to_le_bytes()],
        bump,
        constraint = application.listing == listing.key()
    )]
    pub application: Account<'info, Application>,
    
    pub signer: Signer<'info>,
}
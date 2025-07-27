use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::events::{ApplicationSubmitted, ApplicationApproved, ApplicationRejected};
use crate::state::{Application, Listing, APPLICATION_STATUS_PENDING, APPLICATION_STATUS_APPROVED, APPLICATION_STATUS_REJECTED, LISTING_STATUS_AVAILABLE};

#[derive(Accounts)]
pub struct ApplyLease<'info> {
    #[account(
        seeds = [Listing::SEED, listing.property_attest.as_ref()],
        bump,
        constraint = listing.status == LISTING_STATUS_AVAILABLE @ ErrorCode::ListingAlreadyRented
    )]
    pub listing: Account<'info, Listing>,
    
    #[account(
        init,
        payer = applicant,
        space = Application::LEN,
        seeds = [Application::SEED, listing.key().as_ref(), tenant_attest.key().as_ref()],
        bump
    )]
    pub application: Account<'info, Application>,
    
    /// CHECK: 承租人憑證 PDA，由 API 驗證
    pub tenant_attest: AccountInfo<'info>,
    
    #[account(mut)]
    pub applicant: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveApplication<'info> {
    #[account(
        mut,
        seeds = [Application::SEED, listing.key().as_ref(), application.tenant_attest.as_ref()],
        bump,
        constraint = application.status == APPLICATION_STATUS_PENDING @ ErrorCode::ApplicationExpired
    )]
    pub application: Account<'info, Application>,
    
    #[account(
        seeds = [Listing::SEED, listing.property_attest.as_ref()],
        bump,
        constraint = listing.owner == landlord.key() @ ErrorCode::Unauthorized,
        constraint = listing.status == LISTING_STATUS_AVAILABLE @ ErrorCode::ListingAlreadyRented
    )]
    pub listing: Account<'info, Listing>,
    
    pub landlord: Signer<'info>,
}

#[derive(Accounts)]
pub struct RejectApplication<'info> {
    #[account(
        mut,
        seeds = [Application::SEED, listing.key().as_ref(), application.tenant_attest.as_ref()],
        bump,
        constraint = application.status == APPLICATION_STATUS_PENDING @ ErrorCode::ApplicationExpired
    )]
    pub application: Account<'info, Application>,
    
    #[account(
        seeds = [Listing::SEED, listing.property_attest.as_ref()],
        bump,
        constraint = listing.owner == landlord.key() @ ErrorCode::Unauthorized
    )]
    pub listing: Account<'info, Listing>,
    
    pub landlord: Signer<'info>,
}

pub fn apply_lease(ctx: Context<ApplyLease>, message: String) -> Result<()> {
    let application = &mut ctx.accounts.application;
    let clock = Clock::get()?;
    
    application.listing = ctx.accounts.listing.key();
    application.applicant = ctx.accounts.applicant.key();
    application.tenant_attest = ctx.accounts.tenant_attest.key();
    application.message = message;
    application.status = APPLICATION_STATUS_PENDING;
    application.created_at = clock.unix_timestamp;
    
    emit!(ApplicationSubmitted {
        application: ctx.accounts.application.key(),
        listing: ctx.accounts.listing.key(),
        applicant: ctx.accounts.applicant.key(),
    });
    
    Ok(())
}

pub fn approve_application(ctx: Context<ApproveApplication>) -> Result<()> {
    let application = &mut ctx.accounts.application;
    
    application.status = APPLICATION_STATUS_APPROVED;
    
    // Clone values for event
    let tenant_key = application.applicant;
    
    emit!(ApplicationApproved {
        application: ctx.accounts.application.key(),
        listing: ctx.accounts.listing.key(),
        tenant: tenant_key,
    });
    
    Ok(())
}

pub fn reject_application(ctx: Context<RejectApplication>) -> Result<()> {
    let application = &mut ctx.accounts.application;
    
    application.status = APPLICATION_STATUS_REJECTED;
    
    // Clone values for event
    let applicant_key = application.applicant;
    
    emit!(ApplicationRejected {
        application: ctx.accounts.application.key(),
        listing: ctx.accounts.listing.key(),
        applicant: applicant_key,
    });
    
    Ok(())
}
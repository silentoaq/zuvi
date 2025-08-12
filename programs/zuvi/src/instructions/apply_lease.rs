use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, events::*, state::*};

pub fn apply_lease(
    ctx: Context<ApplyLease>,
    message_uri: [u8; 64],
    created_at: i64,
) -> Result<()> {
    let config = &ctx.accounts.config;
    let listing = &ctx.accounts.listing;
    let applicant = &ctx.accounts.applicant;
    
    require!(
        config.initialized,
        ZuviError::NotInitialized
    );
    
    require!(
        ctx.accounts.api_signer.key() == config.api_signer,
        ZuviError::ApiSignatureRequired
    );
    
    require!(
        listing.status == LISTING_STATUS_AVAILABLE,
        ZuviError::ListingInactive
    );
    
    require!(
        listing.owner != applicant.key(),
        ZuviError::CannotApplyOwnListing
    );
    
    let application = &mut ctx.accounts.application;
    
    application.listing = listing.key();
    application.applicant = applicant.key();
    application.tenant_attest = ctx.accounts.tenant_attest.key();
    application.message_uri = message_uri;
    application.status = APPLICATION_STATUS_PENDING;
    application.created_at = created_at;
    
    emit!(ApplicationSubmitted {
        application: application.key(),
        listing: application.listing,
        applicant: application.applicant,
        tenant_attest: application.tenant_attest,
        created_at: application.created_at,
    });
    
    msg!("租賃申請已提交");
    msg!("申請人: {}", application.applicant);
    msg!("房源: {}", application.listing);
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(message_uri: [u8; 64], created_at: i64)]
pub struct ApplyLease<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    
    #[account(
        seeds = [LISTING_SEED, listing.property_attest.as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    
    #[account(
        init,
        payer = applicant,
        space = APPLICATION_SIZE,
        seeds = [APPLICATION_SEED, listing.key().as_ref(), applicant.key().as_ref(), &created_at.to_le_bytes()],
        bump
    )]
    pub application: Account<'info, Application>,
    
    #[account(mut)]
    pub applicant: Signer<'info>,
    
    pub api_signer: Signer<'info>,
    
    /// CHECK: 由 API 驗證
    pub tenant_attest: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}
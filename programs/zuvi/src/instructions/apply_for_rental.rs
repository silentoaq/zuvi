use anchor_lang::prelude::*;
use crate::errors::ZuviError;
use crate::state::{PropertyListing, RentalApplication, ApplicationStatus, ListingStatus};

#[derive(Accounts)]
pub struct ApplyForRental<'info> {
    #[account(
        constraint = listing.status == ListingStatus::Available @ ZuviError::InvalidListingStatus
    )]
    pub listing: Account<'info, PropertyListing>,

    #[account(
        init,
        payer = applicant,
        space = RentalApplication::SIZE,
        seeds = [b"application", listing.key().as_ref(), applicant.key().as_ref()],
        bump
    )]
    pub application: Account<'info, RentalApplication>,

    #[account(mut)]
    pub applicant: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn apply_for_rental(
    ctx: Context<ApplyForRental>,
    applicant_attestation: String,
    proposed_terms: String,
) -> Result<()> {
    let application = &mut ctx.accounts.application;
    let clock = &ctx.accounts.clock;

    // 驗證輸入
    require!(applicant_attestation.len() <= 128, ZuviError::StringTooLong);
    require!(proposed_terms.len() <= 256, ZuviError::StringTooLong);
    require!(!applicant_attestation.is_empty(), ZuviError::InvalidAttestation);

    // 初始化申請
    application.listing = ctx.accounts.listing.key();
    application.applicant = ctx.accounts.applicant.key();
    application.applicant_attestation = applicant_attestation;
    application.proposed_terms = proposed_terms;
    application.status = ApplicationStatus::Pending;
    application.created_at = clock.unix_timestamp;
    application.updated_at = clock.unix_timestamp;
    application.bump = ctx.bumps.application;

    msg!("Rental application submitted successfully");
    msg!("Listing: {}", application.listing);
    msg!("Applicant: {}", application.applicant);

    Ok(())
}
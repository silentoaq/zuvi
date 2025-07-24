use anchor_lang::prelude::*;
use crate::errors::ZuviError;
use crate::state::{PropertyListing, RentalApplication, ApplicationStatus, ListingStatus};

#[derive(Accounts)]
pub struct ApplyForRental<'info> {
    #[account(
        constraint = listing.status == ListingStatus::Available @ ZuviError::InvalidListingStatus
    )]
    pub listing: Box<Account<'info, PropertyListing>>,

    #[account(
        init,
        payer = applicant,
        space = RentalApplication::SIZE,
        seeds = [b"application", listing.key().as_ref(), applicant.key().as_ref()],
        bump
    )]
    pub application: Box<Account<'info, RentalApplication>>,

    #[account(mut)]
    pub applicant: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn apply(
    ctx: Context<ApplyForRental>,
    applicant_attestation: String,
    proposed_terms: String,
) -> Result<()> {
    let application = &mut *ctx.accounts.application;
    let clock = &ctx.accounts.clock;

    // 驗證
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
    let (_, bump) = Pubkey::find_program_address(
        &[b"application", ctx.accounts.listing.key().as_ref(), ctx.accounts.applicant.key().as_ref()],
        &crate::ID
    );
    application.bump = bump;

    msg!("申請成功");

    Ok(())
}

#[derive(Accounts)]
pub struct AcceptApplication<'info> {
    #[account(
        constraint = listing.owner == owner.key() @ ZuviError::NotPropertyOwner
    )]
    pub listing: Account<'info, PropertyListing>,

    #[account(
        mut,
        constraint = application.listing == listing.key() @ ZuviError::InvalidApplicationStatus,
        constraint = application.status == ApplicationStatus::Pending @ ZuviError::InvalidApplicationStatus
    )]
    pub application: Account<'info, RentalApplication>,

    pub owner: Signer<'info>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn accept(ctx: Context<AcceptApplication>) -> Result<()> {
    let application = &mut ctx.accounts.application;
    let clock = &ctx.accounts.clock;

    application.status = ApplicationStatus::Accepted;
    application.updated_at = clock.unix_timestamp;

    msg!("申請已接受");

    Ok(())
}

#[derive(Accounts)]
pub struct RejectApplication<'info> {
    #[account(
        constraint = listing.owner == owner.key() @ ZuviError::NotPropertyOwner
    )]
    pub listing: Account<'info, PropertyListing>,

    #[account(
        mut,
        constraint = application.listing == listing.key() @ ZuviError::InvalidApplicationStatus,
        constraint = application.status == ApplicationStatus::Pending @ ZuviError::InvalidApplicationStatus
    )]
    pub application: Account<'info, RentalApplication>,

    pub owner: Signer<'info>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn reject(ctx: Context<RejectApplication>) -> Result<()> {
    let application = &mut ctx.accounts.application;
    let clock = &ctx.accounts.clock;

    application.status = ApplicationStatus::Rejected;
    application.updated_at = clock.unix_timestamp;

    msg!("申請已拒絕");

    Ok(())
}
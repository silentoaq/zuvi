use anchor_lang::prelude::*;
use crate::errors::ZuviError;
use crate::state::{PropertyListing, RentalApplication, ApplicationStatus};

#[derive(Accounts)]
pub struct AcceptApplication<'info> {
    #[account(
        mut,
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

pub fn accept_application(ctx: Context<AcceptApplication>) -> Result<()> {
    let application = &mut ctx.accounts.application;
    let clock = &ctx.accounts.clock;

    // 更新申請狀態
    application.status = ApplicationStatus::Accepted;
    application.updated_at = clock.unix_timestamp;

    msg!("Application accepted successfully");
    msg!("Application: {}", application.key());
    msg!("Applicant: {}", application.applicant);

    Ok(())
}
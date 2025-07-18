use anchor_lang::prelude::*;
use crate::errors::ZuviError;
use crate::state::{PropertyListing, RentalApplication, ApplicationStatus};

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

pub fn reject_application(ctx: Context<RejectApplication>) -> Result<()> {
    let application = &mut ctx.accounts.application;
    let clock = &ctx.accounts.clock;

    // 更新申請狀態
    application.status = ApplicationStatus::Rejected;
    application.updated_at = clock.unix_timestamp;

    msg!("Application rejected");
    msg!("Application: {}", application.key());
    msg!("Applicant: {}", application.applicant);

    Ok(())
}
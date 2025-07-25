use anchor_lang::prelude::*;
use crate::state::{PropertyListing, RentalApplication, ApplicationStatus, ListingStatus};
use crate::errors::ZuviError;

#[derive(Accounts)]
pub struct ApplyRental<'info> {
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

#[derive(Accounts)]
pub struct CounterOffer<'info> {
    #[account(
        constraint = listing.owner == owner.key() || application.applicant == owner.key() 
            @ ZuviError::NotContractParty
    )]
    pub listing: Account<'info, PropertyListing>,

    #[account(
        mut,
        constraint = application.listing == listing.key() @ ZuviError::InvalidApplicationStatus,
        constraint = application.status == ApplicationStatus::Pending 
            || application.status == ApplicationStatus::Negotiating 
            @ ZuviError::InvalidApplicationStatus,
        constraint = application.last_actor != owner.key() @ ZuviError::InvalidCounterOffer
    )]
    pub application: Account<'info, RentalApplication>,

    #[account(mut)]
    pub owner: Signer<'info>,
    pub clock: Sysvar<'info, Clock>,
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
        constraint = application.status == ApplicationStatus::Pending 
            || application.status == ApplicationStatus::Negotiating 
            @ ZuviError::InvalidApplicationStatus,
        constraint = application.last_actor == application.applicant @ ZuviError::MustAcceptApplicantOffer
    )]
    pub application: Account<'info, RentalApplication>,

    pub owner: Signer<'info>,
    pub clock: Sysvar<'info, Clock>,
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
        constraint = application.status == ApplicationStatus::Pending 
            || application.status == ApplicationStatus::Negotiating 
            @ ZuviError::InvalidApplicationStatus,
        close = applicant
    )]
    pub application: Account<'info, RentalApplication>,

    /// CHECK: 申請人帳戶，用於退還租金
    pub applicant: UncheckedAccount<'info>,

    pub owner: Signer<'info>,
    pub clock: Sysvar<'info, Clock>,
}
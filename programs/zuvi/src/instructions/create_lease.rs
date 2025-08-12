use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, events::*, state::*};

pub fn create_lease(
    ctx: Context<CreateLease>,
    applicant: Pubkey,
    _application_created_at: i64,
    start_date: i64,
    end_date: i64,
    payment_day: u8,
    contract_uri: [u8; 64],
) -> Result<()> {
    let listing = &ctx.accounts.listing;
    let application = &ctx.accounts.application;
    let clock = Clock::get()?;
    
    require!(
        listing.owner == ctx.accounts.landlord.key(),
        ZuviError::Unauthorized
    );
    
    require!(
        application.status == APPLICATION_STATUS_APPROVED,
        ZuviError::InvalidApplication
    );
    
    require!(
        application.applicant == applicant,
        ZuviError::InvalidParameter
    );
    
    require!(
        !listing.has_active_lease,
        ZuviError::LeaseAlreadyExists
    );
    
    require!(
        start_date > clock.unix_timestamp,
        ZuviError::InvalidDate
    );
    require!(
        start_date < clock.unix_timestamp + (MAX_ADVANCE_DAYS * SECONDS_PER_DAY),
        ZuviError::InvalidDate
    );
    require!(
        end_date > start_date,
        ZuviError::InvalidDate
    );
    
    require!(
        payment_day >= MIN_PAYMENT_DAY && payment_day <= MAX_PAYMENT_DAY,
        ZuviError::InvalidPaymentDay
    );
    
    let lease = &mut ctx.accounts.lease;
    
    lease.listing = listing.key();
    lease.landlord = ctx.accounts.landlord.key();
    lease.tenant = applicant;
    lease.tenant_attest = application.tenant_attest;
    lease.rent = listing.rent;
    lease.deposit = listing.deposit;
    lease.start_date = start_date;
    lease.end_date = end_date;
    lease.payment_day = payment_day;
    lease.paid_months = 0;
    lease.last_payment = 0;
    lease.contract_uri = contract_uri;
    lease.status = LEASE_STATUS_ACTIVE;
    lease.landlord_signed = true;
    lease.tenant_signed = false;
    
    emit!(LeaseCreated {
        lease: lease.key(),
        listing: lease.listing,
        landlord: lease.landlord,
        tenant: lease.tenant,
        start_date: lease.start_date,
        end_date: lease.end_date,
        rent: lease.rent,
        deposit: lease.deposit,
    });
    
    msg!("租約已創建，等待承租人簽署");
    msg!("房東: {}", lease.landlord);
    msg!("承租人: {}", lease.tenant);
    msg!("租期: {} 至 {}", start_date, end_date);
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(applicant: Pubkey, _application_created_at: i64, start_date: i64)]
pub struct CreateLease<'info> {
    #[account(
        seeds = [LISTING_SEED, listing.property_attest.as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    
    #[account(
        seeds = [APPLICATION_SEED, listing.key().as_ref(), applicant.as_ref(), &_application_created_at.to_le_bytes()],
        bump
    )]
    pub application: Account<'info, Application>,
    
    #[account(
        init,
        payer = landlord,
        space = LEASE_SIZE,
        seeds = [LEASE_SEED, listing.key().as_ref(), applicant.as_ref(), &start_date.to_le_bytes()],
        bump
    )]
    pub lease: Account<'info, Lease>,
    
    #[account(mut)]
    pub landlord: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}
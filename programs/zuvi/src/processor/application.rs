use anchor_lang::prelude::*;
use crate::context::application::*;
use crate::state::ApplicationStatus;
use crate::errors::ZuviError;

pub fn apply(
    ctx: Context<ApplyRental>,
    attest_pda: Pubkey,
    offer_rent: u64,
    offer_deposit: u64,
    offer_hash: String,
) -> Result<()> {
    require!(offer_hash.len() <= 64, ZuviError::StringTooLong);
    require!(attest_pda != Pubkey::default(), ZuviError::InvalidAttestation);
    require!(offer_rent > 0, ZuviError::RentMustBeGreaterThanZero);
    require!(offer_deposit > 0, ZuviError::DepositMustBeGreaterThanZero);

    let application = &mut ctx.accounts.application;
    let clock = &ctx.accounts.clock;

    application.listing = ctx.accounts.listing.key();
    application.applicant = ctx.accounts.applicant.key();
    application.attest_pda = attest_pda;
    application.offer_rent = offer_rent;
    application.offer_deposit = offer_deposit;
    application.offer_hash = offer_hash;
    application.counter = 0;
    application.last_actor = ctx.accounts.applicant.key();
    application.status = ApplicationStatus::Pending;
    application.created = clock.unix_timestamp;
    application.updated = clock.unix_timestamp;
    
    let (_, bump) = Pubkey::find_program_address(
        &[b"application", ctx.accounts.listing.key().as_ref(), ctx.accounts.applicant.key().as_ref()],
        &crate::ID
    );
    application.bump = bump;

    Ok(())
}

pub fn counter(
    ctx: Context<CounterOffer>,
    new_rent: u64,
    new_deposit: u64,
    new_hash: String,
) -> Result<()> {
    require!(new_hash.len() <= 64, ZuviError::StringTooLong);
    require!(new_rent > 0, ZuviError::RentMustBeGreaterThanZero);
    require!(new_deposit > 0, ZuviError::DepositMustBeGreaterThanZero);
    require!(ctx.accounts.application.counter < 10, ZuviError::TooManyCounters); // 限制協商次數

    let application = &mut ctx.accounts.application;
    let clock = &ctx.accounts.clock;

    application.offer_rent = new_rent;
    application.offer_deposit = new_deposit;
    application.offer_hash = new_hash;
    application.counter = application.counter.saturating_add(1);
    application.last_actor = ctx.accounts.owner.key();
    application.status = ApplicationStatus::Negotiating;
    application.updated = clock.unix_timestamp;

    Ok(())
}

pub fn accept(ctx: Context<AcceptApplication>) -> Result<()> {
    let application = &mut ctx.accounts.application;
    let clock = &ctx.accounts.clock;

    application.status = ApplicationStatus::Accepted;
    application.updated = clock.unix_timestamp;

    Ok(())
}

pub fn reject(_ctx: Context<RejectApplication>) -> Result<()> {
    // 帳戶會自動關閉
    Ok(())
}
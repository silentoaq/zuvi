use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};
use crate::context::property::*;
use crate::state::ListingStatus;
use crate::errors::ZuviError;
use crate::events::PropertyListed;

pub fn list(
    ctx: Context<ListProperty>,
    attest_pda: Pubkey,
    m_rent: u64,
    dep_months: u8,
    details: String,
) -> Result<()> {
    require!(details.len() <= 64, ZuviError::StringTooLong);
    require!(m_rent > 0, ZuviError::RentMustBeGreaterThanZero);
    require!(dep_months > 0, ZuviError::DepositMustBeGreaterThanZero);
    require!(attest_pda != Pubkey::default(), ZuviError::InvalidAttestation);

    // 收取上架費
    let cpi_accounts = Transfer {
        from: ctx.accounts.owner_usdc.to_account_info(),
        to: ctx.accounts.plat_usdc.to_account_info(),
        authority: ctx.accounts.owner.to_account_info(),
    };
    
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
        ctx.accounts.platform.list_fee
    )?;

    let listing = &mut ctx.accounts.listing;
    let clock = &ctx.accounts.clock;

    listing.owner = ctx.accounts.owner.key();
    listing.attest_pda = attest_pda;
    listing.m_rent = m_rent;
    listing.dep_months = dep_months;
    listing.details = details;
    listing.cur_contract = None;
    listing.status = ListingStatus::Available;
    listing.created = clock.unix_timestamp;
    
    let (_, bump) = Pubkey::find_program_address(
        &[b"listing", attest_pda.as_ref()],
        &crate::ID
    );
    listing.bump = bump;

    emit!(PropertyListed {
        listing: listing.key(),
        owner: listing.owner,
        property_id: listing.key().to_string(),
        m_rent: m_rent,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

pub fn delist(ctx: Context<DelistProperty>) -> Result<()> {
    // 帳戶會自動關閉，返還租金給 owner
    Ok(())
}
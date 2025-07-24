use anchor_lang::prelude::*;
use anchor_lang::emit;
use anchor_spl::token::{self, Token, Transfer};
use anchor_spl::token_interface::TokenAccount;
use crate::errors::ZuviError;
use crate::state::{Platform, PropertyListing, ListingStatus};
use crate::events::PropertyListed;

#[derive(Accounts)]
#[instruction(property_id: String)]
pub struct ListProperty<'info> {
    #[account(
        seeds = [b"platform"],
        bump,
        constraint = platform.is_initialized @ ZuviError::PlatformNotInitialized
    )]
    pub platform: Box<Account<'info, Platform>>,

    #[account(
        init,
        payer = owner,
        space = PropertyListing::SIZE,
        seeds = [b"listing", property_id.as_bytes()],
        bump
    )]
    pub listing: Box<Account<'info, PropertyListing>>,

    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        constraint = owner_usdc_account.owner == owner.key(),
        constraint = owner_usdc_account.mint == platform.usdc_mint
    )]
    pub owner_usdc_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = platform_usdc_account.owner == platform.fee_receiver,
        constraint = platform_usdc_account.mint == platform.usdc_mint
    )]
    pub platform_usdc_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn list(
    ctx: Context<ListProperty>,
    property_id: String,
    owner_attestation: String,
    monthly_rent: u64,
    deposit_months: u8,
    property_details_hash: String,
) -> Result<()> {
    let platform = &*ctx.accounts.platform;
    let listing = &mut *ctx.accounts.listing;
    let clock = &ctx.accounts.clock;

    // 驗證
    require!(property_id.len() <= 64, ZuviError::StringTooLong);
    require!(owner_attestation.len() <= 128, ZuviError::StringTooLong);
    require!(property_details_hash.len() <= 64, ZuviError::StringTooLong);
    require!(monthly_rent > 0, ZuviError::RentMustBeGreaterThanZero);
    require!(deposit_months > 0, ZuviError::DepositMustBeGreaterThanZero);
    require!(!owner_attestation.is_empty(), ZuviError::InvalidAttestation);

    // 支付費用
    let cpi_accounts = Transfer {
        from: ctx.accounts.owner_usdc_account.to_account_info(),
        to: ctx.accounts.platform_usdc_account.to_account_info(),
        authority: ctx.accounts.owner.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
        platform.listing_fee
    )?;

    // 初始化房源
    listing.owner = ctx.accounts.owner.key();
    listing.property_id = property_id.clone();
    listing.owner_attestation = owner_attestation;
    listing.monthly_rent = monthly_rent;
    listing.deposit_months = deposit_months;
    listing.property_details_hash = property_details_hash;
    listing.current_contract = None;
    listing.status = ListingStatus::Available;
    listing.created_at = clock.unix_timestamp;
    let (_, bump) = Pubkey::find_program_address(
        &[b"listing", property_id.as_bytes()],
        &crate::ID
    );
    listing.bump = bump;

    // 發送事件
    emit!(PropertyListed {
        listing: listing.key(),
        owner: listing.owner,
        property_id,
        monthly_rent,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct DelistProperty<'info> {
    #[account(
        mut,
        constraint = listing.owner == owner.key() @ ZuviError::NotPropertyOwner,
        constraint = listing.status == ListingStatus::Available @ ZuviError::InvalidListingStatus
    )]
    pub listing: Account<'info, PropertyListing>,

    pub owner: Signer<'info>,
}

pub fn delist(ctx: Context<DelistProperty>) -> Result<()> {
    let listing = &mut ctx.accounts.listing;
    
    listing.status = ListingStatus::Delisted;
    
    msg!("房源已下架: {}", listing.property_id);

    Ok(())
}
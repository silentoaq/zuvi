use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::errors::ZuviError;
use crate::state::{Platform, PropertyListing, ListingStatus};

#[derive(Accounts)]
#[instruction(property_id: String)]
pub struct ListProperty<'info> {
    #[account(
        seeds = [b"platform"],
        bump = platform.bump,
        constraint = platform.is_initialized @ ZuviError::PlatformNotInitialized
    )]
    pub platform: Account<'info, Platform>,

    #[account(
        init,
        payer = owner,
        space = PropertyListing::SIZE,
        seeds = [b"listing", property_id.as_bytes()],
        bump
    )]
    pub listing: Account<'info, PropertyListing>,

    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        constraint = owner_usdc_account.owner == owner.key(),
        constraint = owner_usdc_account.mint == platform.usdc_mint
    )]
    pub owner_usdc_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = platform_usdc_account.owner == platform.fee_receiver,
        constraint = platform_usdc_account.mint == platform.usdc_mint
    )]
    pub platform_usdc_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn list_property(
    ctx: Context<ListProperty>,
    property_id: String,
    owner_attestation: String,
    monthly_rent: u64,
    deposit_months: u8,
    property_details_hash: String,
) -> Result<()> {
    let platform = &ctx.accounts.platform;
    let listing = &mut ctx.accounts.listing;
    let clock = &ctx.accounts.clock;

    // 驗證輸入
    require!(property_id.len() <= 64, ZuviError::StringTooLong);
    require!(owner_attestation.len() <= 128, ZuviError::StringTooLong);
    require!(property_details_hash.len() <= 64, ZuviError::StringTooLong);
    require!(monthly_rent > 0, ZuviError::RentMustBeGreaterThanZero);
    require!(deposit_months > 0, ZuviError::DepositMustBeGreaterThanZero);

    // 驗證 attestation 格式 (簡單檢查)
    require!(!owner_attestation.is_empty(), ZuviError::InvalidAttestation);

    // 支付發布費用
    let cpi_accounts = Transfer {
        from: ctx.accounts.owner_usdc_account.to_account_info(),
        to: ctx.accounts.platform_usdc_account.to_account_info(),
        authority: ctx.accounts.owner.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, platform.listing_fee)?;

    // 初始化房源
    listing.property_id = property_id;
    listing.owner = ctx.accounts.owner.key();
    listing.owner_attestation = owner_attestation;
    listing.monthly_rent = monthly_rent;
    listing.deposit_months = deposit_months;
    listing.property_details_hash = property_details_hash;
    listing.status = ListingStatus::Available;
    listing.current_tenant = None;
    listing.current_contract = None;
    listing.created_at = clock.unix_timestamp;
    listing.bump = ctx.bumps.listing;

    msg!("Property listed successfully");
    msg!("Property ID: {}", listing.property_id);
    msg!("Monthly rent: {} USDC", monthly_rent);
    msg!("Deposit: {} months", deposit_months);

    Ok(())
}
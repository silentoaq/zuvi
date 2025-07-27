use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::events::{ListingCreated, ListingUpdated};
use crate::state::{Config, Listing, LISTING_STATUS_AVAILABLE, LISTING_STATUS_INACTIVE, LISTING_STATUS_RENTED, MAX_GRACE_DAYS};

#[derive(Accounts)]
pub struct CreateListing<'info> {
    #[account(
        seeds = [Config::SEED],
        bump,
        constraint = config.initialized @ ErrorCode::NotInitialized
    )]
    pub config: Account<'info, Config>,
    
    #[account(
        init,
        payer = owner,
        space = Listing::LEN,
        seeds = [Listing::SEED, property_attest.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    
    /// CHECK: 產權憑證 PDA，由 API 驗證
    pub property_attest: AccountInfo<'info>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    /// CHECK: API 簽名者，驗證憑證有效性
    #[account(
        constraint = api_signer.key() == config.api_signer @ ErrorCode::ApiSignatureRequired
    )]
    pub api_signer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateListing<'info> {
    #[account(
        mut,
        seeds = [Listing::SEED, listing.property_attest.as_ref()],
        bump,
        constraint = listing.owner == owner.key() @ ErrorCode::Unauthorized
    )]
    pub listing: Account<'info, Listing>,
    
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ToggleListing<'info> {
    #[account(
        mut,
        seeds = [Listing::SEED, listing.property_attest.as_ref()],
        bump,
        constraint = listing.owner == owner.key() @ ErrorCode::Unauthorized
    )]
    pub listing: Account<'info, Listing>,
    
    pub owner: Signer<'info>,
}

pub fn create_listing(
    ctx: Context<CreateListing>,
    address: String,
    building_area: u32,
    use_type: String,
    rent: u64,
    deposit: u64,
    grace_days: u8,
    metadata_uri: String,
) -> Result<()> {
    let listing = &mut ctx.accounts.listing;
    let clock = Clock::get()?;
    
    // 驗證參數
    require!(use_type == "住宅", ErrorCode::MustBeResidential);
    require!(deposit >= rent && deposit <= rent * 3, ErrorCode::DepositOutOfRange);
    require!(grace_days <= MAX_GRACE_DAYS, ErrorCode::InvalidGraceDays);
    
    // 設定不可變資料
    listing.owner = ctx.accounts.owner.key();
    listing.property_attest = ctx.accounts.property_attest.key();
    listing.address = address;
    listing.building_area = building_area;
    listing.use_type = use_type;
    
    // 設定可變資料
    listing.rent = rent;
    listing.deposit = deposit;
    listing.status = LISTING_STATUS_AVAILABLE;
    listing.current_lease = None;
    listing.total_leases = 0;
    listing.metadata_uri = metadata_uri;
    listing.grace_days = grace_days;
    listing.created_at = clock.unix_timestamp;
    listing.updated_at = clock.unix_timestamp;
    
    emit!(ListingCreated {
        listing: ctx.accounts.listing.key(),
        owner: ctx.accounts.owner.key(),
        property_attest: ctx.accounts.property_attest.key(),
        rent,
    });
    
    Ok(())
}

pub fn update_listing(
    ctx: Context<UpdateListing>,
    rent: u64,
    deposit: u64,
    grace_days: u8,
    metadata_uri: String,
) -> Result<()> {
    let listing = &mut ctx.accounts.listing;
    let clock = Clock::get()?;
    
    // 驗證參數
    require!(deposit >= rent && deposit <= rent * 3, ErrorCode::DepositOutOfRange);
    require!(grace_days <= MAX_GRACE_DAYS, ErrorCode::InvalidGraceDays);
    
    // 更新可變資料
    listing.rent = rent;
    listing.deposit = deposit;
    listing.grace_days = grace_days;
    listing.metadata_uri = metadata_uri;
    listing.updated_at = clock.unix_timestamp;
    
    // Clone values for event
    let listing_status = listing.status;
    
    emit!(ListingUpdated {
        listing: ctx.accounts.listing.key(),
        rent,
        status: listing_status,
    });
    
    Ok(())
}

pub fn toggle_listing(ctx: Context<ToggleListing>) -> Result<()> {
    let listing = &mut ctx.accounts.listing;
    let clock = Clock::get()?;
    
    match listing.status {
        LISTING_STATUS_AVAILABLE => {
            listing.status = LISTING_STATUS_INACTIVE;
        }
        LISTING_STATUS_INACTIVE => {
            listing.status = LISTING_STATUS_AVAILABLE;
        }
        LISTING_STATUS_RENTED => {
            return Err(ErrorCode::CannotDeactivateWithLease.into());
        }
        _ => return Err(ErrorCode::ListingInactive.into()),
    }
    
    listing.updated_at = clock.unix_timestamp;
    
    // Clone values for event
    let listing_rent = listing.rent;
    let listing_status = listing.status;
    
    emit!(ListingUpdated {
        listing: ctx.accounts.listing.key(),
        rent: listing_rent,
        status: listing_status,
    });
    
    Ok(())
}
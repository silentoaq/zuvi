use anchor_lang::prelude::*;
use crate::errors::ZuviError;
use crate::state::{PropertyListing, ListingStatus};

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

pub fn delist_property(ctx: Context<DelistProperty>) -> Result<()> {
    let listing = &mut ctx.accounts.listing;

    // 更新狀態
    listing.status = ListingStatus::Delisted;

    msg!("Property delisted successfully");
    msg!("Property ID: {}", listing.property_id);

    Ok(())
}
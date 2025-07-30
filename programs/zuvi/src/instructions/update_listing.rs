use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, state::*};

/// 更新房源資訊
pub fn update_listing(
    ctx: Context<UpdateListing>,
    rent: Option<u64>,
    deposit: Option<u64>,
    metadata_uri: Option<[u8; 46]>,
) -> Result<()> {
    let listing = &mut ctx.accounts.listing;
    
    // 確認是房東本人
    require!(
        listing.owner == ctx.accounts.owner.key(),
        ZuviError::Unauthorized
    );
    
    // 只能更新未出租的房源
    require!(
        listing.status != LISTING_STATUS_RENTED,
        ZuviError::ListingAlreadyRented
    );
    
    // 更新租金
    if let Some(new_rent) = rent {
        require!(new_rent > 0, ZuviError::InvalidParameter);
        listing.rent = new_rent;
        msg!("租金已更新為: {} USDC", new_rent);
    }
    
    // 更新押金
    if let Some(new_deposit) = deposit {
        let current_rent = listing.rent;
        let min_deposit = current_rent.checked_mul(MIN_DEPOSIT_MONTHS as u64).unwrap();
        let max_deposit = current_rent.checked_mul(MAX_DEPOSIT_MONTHS as u64).unwrap();
        
        require!(
            new_deposit >= min_deposit && new_deposit <= max_deposit,
            ZuviError::InvalidDepositAmount
        );
        
        listing.deposit = new_deposit;
        msg!("押金已更新為: {} USDC", new_deposit);
    }
    
    // 更新 metadata URI
    if let Some(new_metadata_uri) = metadata_uri {
        listing.metadata_uri = new_metadata_uri;
        msg!("房源資料已更新");
    }
    
    msg!("房源更新成功");
    msg!("房源: {}", listing.key());
    
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateListing<'info> {
    /// 房源列表帳戶
    #[account(
        mut,
        seeds = [LISTING_SEED, listing.property_attest.as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    
    /// 房東
    pub owner: Signer<'info>,
}
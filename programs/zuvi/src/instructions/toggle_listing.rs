use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, state::*};

/// 切換房源狀態（上架/下架）
pub fn toggle_listing(ctx: Context<ToggleListing>) -> Result<()> {
    let listing = &mut ctx.accounts.listing;
    
    // 確認是房東本人
    require!(
        listing.owner == ctx.accounts.owner.key(),
        ZuviError::Unauthorized
    );
    
    // 如果已出租則不能切換
    require!(
        listing.status != LISTING_STATUS_RENTED,
        ZuviError::ListingAlreadyRented
    );
    
    // 切換狀態
    listing.status = match listing.status {
        LISTING_STATUS_AVAILABLE => LISTING_STATUS_INACTIVE,
        LISTING_STATUS_INACTIVE => LISTING_STATUS_AVAILABLE,
        _ => return Err(ZuviError::InvalidParameter.into()),
    };
    
    msg!("房源狀態已切換");
    msg!("新狀態: {}", if listing.status == LISTING_STATUS_AVAILABLE { "可用" } else { "下架" });
    
    Ok(())
}

#[derive(Accounts)]
pub struct ToggleListing<'info> {
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
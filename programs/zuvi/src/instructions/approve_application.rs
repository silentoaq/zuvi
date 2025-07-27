use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, state::*};

/// 核准租賃申請
pub fn approve_application(
    ctx: Context<ApproveApplication>,
    applicant: Pubkey,
) -> Result<()> {
    let listing = &ctx.accounts.listing;
    let application = &mut ctx.accounts.application;
    
    // 確認是房東本人
    require!(
        listing.owner == ctx.accounts.owner.key(),
        ZuviError::Unauthorized
    );
    
    // 確認申請狀態
    require!(
        application.status == APPLICATION_STATUS_PENDING,
        ZuviError::InvalidApplication
    );
    
    // 確認申請人匹配
    require!(
        application.applicant == applicant,
        ZuviError::InvalidParameter
    );
    
    // 確認房源仍可用
    require!(
        listing.status == LISTING_STATUS_AVAILABLE,
        ZuviError::ListingInactive
    );
    
    // 更新申請狀態
    application.status = APPLICATION_STATUS_APPROVED;
    
    msg!("申請已核准");
    msg!("申請人: {}", applicant);
    msg!("房源: {}", listing.key());
    
    Ok(())
}

#[derive(Accounts)]
pub struct ApproveApplication<'info> {
    /// 房源列表帳戶
    #[account(
        seeds = [LISTING_SEED, listing.property_attest.as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    
    /// 申請帳戶
    #[account(
        mut,
        seeds = [APPLICATION_SEED, listing.key().as_ref(), application.applicant.as_ref()],
        bump,
        constraint = application.listing == listing.key()
    )]
    pub application: Account<'info, Application>,
    
    /// 房東
    pub owner: Signer<'info>,
}
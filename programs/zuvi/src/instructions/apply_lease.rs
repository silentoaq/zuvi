use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, state::*};

/// 申請租賃
pub fn apply_lease(
    ctx: Context<ApplyLease>,
    message_uri: [u8; 46],
) -> Result<()> {
    let listing = &ctx.accounts.listing;
    let applicant = &ctx.accounts.applicant;
    
    // 確認房源狀態
    require!(
        listing.status == LISTING_STATUS_AVAILABLE,
        ZuviError::ListingInactive
    );
    
    // 不能申請自己的房源
    require!(
        listing.owner != applicant.key(),
        ZuviError::CannotApplyOwnListing
    );
    
    let application = &mut ctx.accounts.application;
    let clock = Clock::get()?;
    
    // 設定申請資料
    application.listing = listing.key();
    application.applicant = applicant.key();
    application.tenant_attest = ctx.accounts.tenant_attest.key();
    application.message_uri = message_uri;
    application.status = APPLICATION_STATUS_PENDING;
    application.created_at = clock.unix_timestamp;
    
    msg!("租賃申請已提交");
    msg!("申請人: {}", application.applicant);
    msg!("房源: {}", application.listing);
    
    Ok(())
}

#[derive(Accounts)]
pub struct ApplyLease<'info> {
    /// 房源列表帳戶
    #[account(
        seeds = [LISTING_SEED, listing.property_attest.as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    
    /// 申請帳戶
    #[account(
        init,
        payer = applicant,
        space = APPLICATION_SIZE,
        seeds = [APPLICATION_SEED, listing.key().as_ref(), applicant.key().as_ref()],
        bump
    )]
    pub application: Account<'info, Application>,
    
    /// 申請人（支付者）
    #[account(mut)]
    pub applicant: Signer<'info>,
    
    /// 承租人憑證帳戶
    /// CHECK: 由 API 驗證
    pub tenant_attest: AccountInfo<'info>,
    
    /// 系統程式
    pub system_program: Program<'info, System>,
}
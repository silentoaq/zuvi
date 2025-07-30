use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, state::*};

/// 創建租約（房東發起）
pub fn create_lease(
    ctx: Context<CreateLease>,
    applicant: Pubkey,
    start_date: i64,
    end_date: i64,
    payment_day: u8,
    contract_uri: [u8; 64],
) -> Result<()> {
    let listing = &ctx.accounts.listing;
    let application = &ctx.accounts.application;
    let clock = Clock::get()?;
    
    // 確認是房東本人
    require!(
        listing.owner == ctx.accounts.landlord.key(),
        ZuviError::Unauthorized
    );
    
    // 確認申請已核准
    require!(
        application.status == APPLICATION_STATUS_APPROVED,
        ZuviError::InvalidApplication
    );
    
    // 確認申請人匹配
    require!(
        application.applicant == applicant,
        ZuviError::InvalidParameter
    );
    
    // 驗證日期
    require!(
        start_date > clock.unix_timestamp,
        ZuviError::InvalidDate
    );
    require!(
        start_date < clock.unix_timestamp + (MAX_ADVANCE_DAYS * SECONDS_PER_DAY),
        ZuviError::InvalidDate
    );
    require!(
        end_date > start_date,
        ZuviError::InvalidDate
    );
    
    // 驗證繳費日
    require!(
        payment_day >= MIN_PAYMENT_DAY && payment_day <= MAX_PAYMENT_DAY,
        ZuviError::InvalidPaymentDay
    );
    
    let lease = &mut ctx.accounts.lease;
    
    // 設定租約資料
    lease.listing = listing.key();
    lease.landlord = ctx.accounts.landlord.key();
    lease.tenant = applicant;
    lease.tenant_attest = application.tenant_attest;
    lease.rent = listing.rent;
    lease.deposit = listing.deposit;
    lease.start_date = start_date;
    lease.end_date = end_date;
    lease.payment_day = payment_day;
    lease.paid_months = 0;
    lease.last_payment = 0;
    lease.contract_uri = contract_uri;
    lease.status = LEASE_STATUS_ACTIVE;
    lease.landlord_signed = true;  // 房東創建即代表簽署
    lease.tenant_signed = false;
    
    msg!("租約已創建，等待承租人簽署");
    msg!("房東: {}", lease.landlord);
    msg!("承租人: {}", lease.tenant);
    msg!("租期: {} 至 {}", start_date, end_date);
    
    Ok(())
}

#[derive(Accounts)]
pub struct CreateLease<'info> {
    /// 房源列表帳戶
    #[account(
        seeds = [LISTING_SEED, listing.property_attest.as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    
    /// 申請帳戶（用於驗證）
    #[account(
        seeds = [APPLICATION_SEED, listing.key().as_ref(), application.applicant.as_ref()],
        bump
    )]
    pub application: Account<'info, Application>,
    
    /// 租約帳戶
    #[account(
        init,
        payer = landlord,
        space = LEASE_SIZE,
        seeds = [LEASE_SEED, listing.key().as_ref(), application.applicant.as_ref()],
        bump
    )]
    pub lease: Account<'info, Lease>,
    
    /// 房東（支付者）
    #[account(mut)]
    pub landlord: Signer<'info>,
    
    /// 系統程式
    pub system_program: Program<'info, System>,
}
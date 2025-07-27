use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use anchor_spl::token_interface::TokenAccount;
use crate::{constants::*, errors::*, state::*};

/// 支付租金
pub fn pay_rent(ctx: Context<PayRent>) -> Result<()> {
    let config = &ctx.accounts.config;
    let lease = &mut ctx.accounts.lease;
    let clock = Clock::get()?;
    
    // 確認是承租人本人
    require!(
        lease.tenant == ctx.accounts.tenant.key(),
        ZuviError::Unauthorized
    );
    
    // 確認租約生效中
    require!(
        lease.status == LEASE_STATUS_ACTIVE,
        ZuviError::LeaseNotActive
    );
    
    // 確認雙方都已簽署
    require!(
        lease.landlord_signed && lease.tenant_signed,
        ZuviError::NotSigned
    );
    
    // 檢查租約是否已結束
    require!(
        clock.unix_timestamp < lease.end_date,
        ZuviError::LeaseEnded
    );
    
    // 計算下次繳費時間
    let months_since_start = ((clock.unix_timestamp - lease.start_date) / (DAYS_PER_MONTH * SECONDS_PER_DAY)) as u32;
    let should_have_paid = months_since_start + 1; // 加上首期
    
    // 檢查是否已繳費
    require!(
        lease.paid_months < should_have_paid,
        ZuviError::PaymentNotDue
    );
    
    // 計算費用
    let platform_fee = lease.rent
        .checked_mul(config.fee_rate as u64).unwrap()
        .checked_div(10000).unwrap();
    let landlord_rent = lease.rent - platform_fee;
    
    // 轉移租金給房東
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.tenant_token.to_account_info(),
                to: ctx.accounts.landlord_token.to_account_info(),
                authority: ctx.accounts.tenant.to_account_info(),
            },
        ),
        landlord_rent,
    )?;
    
    // 轉移平台費
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.tenant_token.to_account_info(),
                to: ctx.accounts.fee_receiver_token.to_account_info(),
                authority: ctx.accounts.tenant.to_account_info(),
            },
        ),
        platform_fee,
    )?;
    
    // 更新繳費記錄
    lease.paid_months += 1;
    lease.last_payment = clock.unix_timestamp;
    
    msg!("租金已支付");
    msg!("第 {} 期租金", lease.paid_months);
    msg!("房東收到: {} USDC", landlord_rent);
    msg!("平台費: {} USDC", platform_fee);
    
    Ok(())
}

#[derive(Accounts)]
pub struct PayRent<'info> {
    /// 系統配置
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    
    /// 租約
    #[account(
        mut,
        seeds = [LEASE_SEED, lease.listing.as_ref(), lease.tenant.as_ref()],
        bump
    )]
    pub lease: Account<'info, Lease>,
    
    /// 承租人
    #[account(mut)]
    pub tenant: Signer<'info>,
    
    /// 承租人 Token 帳戶
    #[account(
        mut,
        constraint = tenant_token.owner == tenant.key(),
        constraint = tenant_token.mint == config.usdc_mint
    )]
    pub tenant_token: InterfaceAccount<'info, TokenAccount>,
    
    /// 房東 Token 帳戶
    #[account(
        mut,
        constraint = landlord_token.owner == lease.landlord,
        constraint = landlord_token.mint == config.usdc_mint
    )]
    pub landlord_token: InterfaceAccount<'info, TokenAccount>,
    
    /// 平台費接收者 Token 帳戶
    #[account(
        mut,
        constraint = fee_receiver_token.owner == config.fee_receiver,
        constraint = fee_receiver_token.mint == config.usdc_mint
    )]
    pub fee_receiver_token: InterfaceAccount<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use anchor_spl::token_interface::TokenAccount;
use crate::{constants::*, errors::*, state::*, time_utils::TimeUtils};

pub fn pay_rent(ctx: Context<PayRent>) -> Result<()> {
    let config = &ctx.accounts.config;
    let lease = &mut ctx.accounts.lease;
    let clock = Clock::get()?;
    
    require!(
        lease.tenant == ctx.accounts.tenant.key(),
        ZuviError::Unauthorized
    );
    
    require!(
        lease.status == LEASE_STATUS_ACTIVE,
        ZuviError::LeaseNotActive
    );
    
    require!(
        lease.landlord_signed && lease.tenant_signed,
        ZuviError::NotSigned
    );
    
    require!(
        clock.unix_timestamp < lease.end_date,
        ZuviError::LeaseEnded
    );
    
    require!(
        TimeUtils::is_rent_due(
            clock.unix_timestamp,
            lease.start_date,
            lease.payment_day,
            lease.paid_months
        ),
        ZuviError::PaymentNotDue
    );
    
    let platform_fee = lease.rent
        .checked_mul(config.fee_rate as u64).unwrap()
        .checked_div(10000).unwrap();
    let landlord_rent = lease.rent - platform_fee;
    
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
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    
    #[account(
        mut,
        seeds = [LEASE_SEED, lease.listing.as_ref(), lease.tenant.as_ref(), &lease.start_date.to_le_bytes()],
        bump
    )]
    pub lease: Account<'info, Lease>,
    
    #[account(mut)]
    pub tenant: Signer<'info>,
    
    #[account(
        mut,
        constraint = tenant_token.owner == tenant.key(),
        constraint = tenant_token.mint == config.usdc_mint
    )]
    pub tenant_token: InterfaceAccount<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = landlord_token.owner == lease.landlord,
        constraint = landlord_token.mint == config.usdc_mint
    )]
    pub landlord_token: InterfaceAccount<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = fee_receiver_token.owner == config.fee_receiver,
        constraint = fee_receiver_token.mint == config.usdc_mint
    )]
    pub fee_receiver_token: InterfaceAccount<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}
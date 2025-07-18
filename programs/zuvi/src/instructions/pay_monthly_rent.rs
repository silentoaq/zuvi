use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::errors::ZuviError;
use crate::state::{
    Platform, RentalContract, PaymentRecord,
    ContractStatus, PaymentType
};

#[derive(Accounts)]
#[instruction(payment_month: String)]
pub struct PayMonthlyRent<'info> {
    #[account(
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,

    #[account(
        mut,
        constraint = contract.tenant == tenant.key() @ ZuviError::NotContractParty,
        constraint = contract.status == ContractStatus::Active @ ZuviError::InvalidContractStatus
    )]
    pub contract: Account<'info, RentalContract>,

    #[account(mut)]
    pub tenant: Signer<'info>,

    #[account(
        mut,
        constraint = tenant_usdc_account.owner == tenant.key(),
        constraint = tenant_usdc_account.mint == platform.usdc_mint
    )]
    pub tenant_usdc_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = landlord_usdc_account.owner == contract.landlord,
        constraint = landlord_usdc_account.mint == platform.usdc_mint
    )]
    pub landlord_usdc_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = platform_usdc_account.owner == platform.fee_receiver,
        constraint = platform_usdc_account.mint == platform.usdc_mint
    )]
    pub platform_usdc_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = tenant,
        space = PaymentRecord::SIZE,
        seeds = [b"payment", contract.key().as_ref(), payment_month.as_bytes()],
        bump
    )]
    pub payment_record: Account<'info, PaymentRecord>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn pay_monthly_rent(
    ctx: Context<PayMonthlyRent>,
    payment_month: String,
) -> Result<()> {
    let platform = &ctx.accounts.platform;
    let contract = &mut ctx.accounts.contract;
    let clock = &ctx.accounts.clock;

    // 驗證合約時效
    require!(
        clock.unix_timestamp >= contract.start_date,
        ZuviError::ContractNotStarted
    );
    require!(
        clock.unix_timestamp <= contract.end_date,
        ZuviError::ContractEnded
    );

    // 驗證月份格式
    require!(payment_month.len() <= 20, ZuviError::StringTooLong);

    // 支付租金給房東
    let cpi_accounts = Transfer {
        from: ctx.accounts.tenant_usdc_account.to_account_info(),
        to: ctx.accounts.landlord_usdc_account.to_account_info(),
        authority: ctx.accounts.tenant.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, contract.monthly_rent)?;

    // 支付平台手續費
    let cpi_accounts = Transfer {
        from: ctx.accounts.tenant_usdc_account.to_account_info(),
        to: ctx.accounts.platform_usdc_account.to_account_info(),
        authority: ctx.accounts.tenant.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, platform.payment_fee)?;

    // 記錄支付
    let payment_record = &mut ctx.accounts.payment_record;
    payment_record.contract = contract.key();
    payment_record.payment_type = PaymentType::MonthlyRent;
    payment_record.amount = contract.monthly_rent;
    payment_record.payer = ctx.accounts.tenant.key();
    payment_record.receiver = contract.landlord;
    payment_record.payment_month = Some(payment_month.clone());
    payment_record.paid_at = clock.unix_timestamp;
    payment_record.transaction_signature = ctx.accounts.tenant.key().to_string();
    payment_record.bump = ctx.bumps.payment_record;

    // 更新已支付月數
    contract.paid_months = contract.paid_months.saturating_add(1);

    msg!("Monthly rent paid successfully");
    msg!("Month: {}", payment_month);
    msg!("Amount: {} USDC", contract.monthly_rent);
    msg!("Platform fee: {} USDC", platform.payment_fee);

    Ok(())
}
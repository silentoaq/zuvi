use anchor_lang::prelude::*;
use anchor_lang::emit;
use anchor_spl::token::{self, Token, Transfer};
use anchor_spl::token_interface::TokenAccount;
use crate::errors::ZuviError;
use crate::state::*;
use crate::events::RentPaid;

#[derive(Accounts)]
#[instruction(payment_month: String)]
pub struct PayMonthlyRent<'info> {
    #[account(
        seeds = [b"platform"],
        bump
    )]
    pub platform: Box<Account<'info, Platform>>,

    #[account(
        mut,
        constraint = contract.tenant == tenant.key() @ ZuviError::NotContractParty,
        constraint = contract.status == ContractStatus::Active @ ZuviError::InvalidContractStatus
    )]
    pub contract: Box<Account<'info, RentalContract>>,

    #[account(mut)]
    pub tenant: Signer<'info>,

    #[account(
        mut,
        constraint = tenant_usdc_account.owner == tenant.key(),
        constraint = tenant_usdc_account.mint == platform.usdc_mint
    )]
    pub tenant_usdc_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = landlord_usdc_account.owner == contract.landlord,
        constraint = landlord_usdc_account.mint == platform.usdc_mint
    )]
    pub landlord_usdc_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = platform_usdc_account.owner == platform.fee_receiver,
        constraint = platform_usdc_account.mint == platform.usdc_mint
    )]
    pub platform_usdc_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = tenant,
        space = PaymentRecord::SIZE,
        seeds = [b"payment", contract.key().as_ref(), payment_month.as_bytes()],
        bump
    )]
    pub payment_record: Box<Account<'info, PaymentRecord>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn pay_rent(
    ctx: Context<PayMonthlyRent>,
    payment_month: String,
) -> Result<()> {
    let platform = &*ctx.accounts.platform;
    let contract = &mut *ctx.accounts.contract;
    let clock = &ctx.accounts.clock;

    // 驗證
    require!(
        clock.unix_timestamp >= contract.start_date,
        ZuviError::ContractNotStarted
    );
    require!(
        clock.unix_timestamp <= contract.end_date,
        ZuviError::ContractEnded
    );
    require!(payment_month.len() <= 20, ZuviError::StringTooLong);

    // 支付租金
    let cpi_accounts = Transfer {
        from: ctx.accounts.tenant_usdc_account.to_account_info(),
        to: ctx.accounts.landlord_usdc_account.to_account_info(),
        authority: ctx.accounts.tenant.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
        contract.monthly_rent
    )?;

    // 支付平台費
    let cpi_accounts = Transfer {
        from: ctx.accounts.tenant_usdc_account.to_account_info(),
        to: ctx.accounts.platform_usdc_account.to_account_info(),
        authority: ctx.accounts.tenant.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
        platform.payment_fee
    )?;

    // 更新已付月數
    contract.paid_months = contract.paid_months.saturating_add(1);

    // 記錄支付
    let payment_record = &mut *ctx.accounts.payment_record;
    payment_record.contract = contract.key();
    payment_record.payer = ctx.accounts.tenant.key();
    payment_record.recipient = contract.landlord;
    payment_record.amount = contract.monthly_rent;
    payment_record.payment_type = PaymentType::MonthlyRent;
    payment_record.payment_month = Some(payment_month.clone());
    payment_record.timestamp = clock.unix_timestamp;
    let (_, bump) = Pubkey::find_program_address(
        &[b"payment", contract.key().as_ref(), payment_month.as_bytes()],
        &crate::ID
    );
    payment_record.bump = bump;

    // 發送事件
    emit!(RentPaid {
        contract: contract.key(),
        tenant: contract.tenant,
        amount: contract.monthly_rent,
        payment_month,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
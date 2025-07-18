use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use anchor_spl::token_interface::TokenAccount;
use crate::errors::ZuviError;
use crate::state::{
    Platform, PropertyListing, RentalContract, PaymentRecord,
    ContractStatus, ListingStatus, PaymentType
};

#[derive(Accounts)]
pub struct SignContractAndPay<'info> {
    #[account(
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,

    #[account(
        mut,
        constraint = listing.status == ListingStatus::Available @ ZuviError::InvalidListingStatus
    )]
    pub listing: Account<'info, PropertyListing>,

    #[account(
        mut,
        constraint = contract.tenant == tenant.key() @ ZuviError::NotContractParty,
        constraint = contract.status == ContractStatus::PendingSignature @ ZuviError::InvalidContractStatus
    )]
    pub contract: Account<'info, RentalContract>,

    #[account(mut)]
    pub tenant: Signer<'info>,

    #[account(
        mut,
        constraint = tenant_usdc_account.owner == tenant.key(),
        constraint = tenant_usdc_account.mint == platform.usdc_mint
    )]
    pub tenant_usdc_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: 託管賬戶 PDA
    #[account(
        mut,
        seeds = [b"escrow", contract.key().as_ref()],
        bump
    )]
    pub escrow_account: UncheckedAccount<'info>,

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
        seeds = [b"payment", contract.key().as_ref(), b"deposit"],
        bump
    )]
    pub deposit_payment_record: Account<'info, PaymentRecord>,

    #[account(
        init,
        payer = tenant,
        space = PaymentRecord::SIZE,
        seeds = [b"payment", contract.key().as_ref(), b"first_month"],
        bump
    )]
    pub first_month_payment_record: Account<'info, PaymentRecord>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn sign_contract_and_pay(ctx: Context<SignContractAndPay>) -> Result<()> {
    let platform = &ctx.accounts.platform;
    let listing = &mut ctx.accounts.listing;
    let contract = &mut ctx.accounts.contract;
    let clock = &ctx.accounts.clock;

    // 計算總支付金額 = 押金 + 首月租金 + 合約費用的一半
    let half_contract_fee = platform.contract_fee / 2;
    let total_payment = contract.deposit_amount
        .checked_add(contract.monthly_rent)
        .and_then(|sum| sum.checked_add(half_contract_fee))
        .ok_or(ProgramError::ArithmeticOverflow)?;

    // 支付到託管賬戶 (押金 + 首月租金)
    let escrow_payment = contract.deposit_amount
        .checked_add(contract.monthly_rent)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    // 轉賬到託管賬戶
    let cpi_accounts = Transfer {
        from: ctx.accounts.tenant_usdc_account.to_account_info(),
        to: ctx.accounts.escrow_account.to_account_info(),
        authority: ctx.accounts.tenant.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, escrow_payment)?;

    // 支付平台費用
    let cpi_accounts = Transfer {
        from: ctx.accounts.tenant_usdc_account.to_account_info(),
        to: ctx.accounts.platform_usdc_account.to_account_info(),
        authority: ctx.accounts.tenant.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, half_contract_fee)?;

    // 記錄押金支付
    let deposit_record = &mut ctx.accounts.deposit_payment_record;
    deposit_record.contract = contract.key();
    deposit_record.payment_type = PaymentType::Deposit;
    deposit_record.amount = contract.deposit_amount;
    deposit_record.payer = ctx.accounts.tenant.key();
    deposit_record.receiver = ctx.accounts.escrow_account.key();
    deposit_record.payment_month = None;
    deposit_record.paid_at = clock.unix_timestamp;
    deposit_record.transaction_signature = ctx.accounts.tenant.key().to_string();
    deposit_record.bump = ctx.bumps.deposit_payment_record;

    // 記錄首月租金支付
    let first_month_record = &mut ctx.accounts.first_month_payment_record;
    first_month_record.contract = contract.key();
    first_month_record.payment_type = PaymentType::FirstMonth;
    first_month_record.amount = contract.monthly_rent;
    first_month_record.payer = ctx.accounts.tenant.key();
    first_month_record.receiver = ctx.accounts.escrow_account.key();
    first_month_record.payment_month = Some(format!("{}", contract.start_date));
    first_month_record.paid_at = clock.unix_timestamp;
    first_month_record.transaction_signature = ctx.accounts.tenant.key().to_string();
    first_month_record.bump = ctx.bumps.first_month_payment_record;

    // 更新合約狀態
    contract.status = ContractStatus::Active;
    contract.paid_months = 1;

    // 更新房源狀態
    listing.status = ListingStatus::Rented;
    listing.current_tenant = Some(ctx.accounts.tenant.key());
    listing.current_contract = Some(contract.key());

    msg!("Contract signed and payment completed");
    msg!("Total payment: {} USDC", total_payment);
    msg!("Deposit: {} USDC", contract.deposit_amount);
    msg!("First month rent: {} USDC", contract.monthly_rent);
    msg!("Platform fee: {} USDC", half_contract_fee);

    Ok(())
}
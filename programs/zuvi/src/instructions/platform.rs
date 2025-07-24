use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use anchor_spl::token_interface::{Mint, TokenAccount};
use crate::errors::ZuviError;
use crate::state::Platform;

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(
        init,
        payer = authority,
        space = Platform::SIZE,
        seeds = [b"platform"],
        bump
    )]
    pub platform: Box<Account<'info, Platform>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub fee_receiver: SystemAccount<'info>,

    pub usdc_mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,
}

pub fn initialize(
    ctx: Context<InitializePlatform>,
    listing_fee: u64,
    contract_fee: u64,
    payment_fee: u64,
) -> Result<()> {
    let platform = &mut *ctx.accounts.platform;

    // 驗證費用
    require!(listing_fee > 0, ZuviError::InvalidFeeAmount);
    require!(contract_fee > 0, ZuviError::InvalidFeeAmount);
    require!(payment_fee > 0, ZuviError::InvalidFeeAmount);

    // 初始化
    platform.authority = ctx.accounts.authority.key();
    platform.fee_receiver = ctx.accounts.fee_receiver.key();
    platform.usdc_mint = ctx.accounts.usdc_mint.key();
    platform.listing_fee = listing_fee;
    platform.contract_fee = contract_fee;
    platform.payment_fee = payment_fee;
    platform.is_initialized = true;
    platform.total_fees_collected = 0;
    let (_, bump) = Pubkey::find_program_address(
        &[b"platform"],
        &crate::ID
    );
    platform.bump = bump;

    msg!("平台初始化成功");

    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(
        seeds = [b"platform"],
        bump,
        constraint = platform.authority == authority.key() @ ZuviError::Unauthorized
    )]
    pub platform: Box<Account<'info, Platform>>,

    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = platform_usdc_account.owner == platform.fee_receiver,
        constraint = platform_usdc_account.mint == platform.usdc_mint
    )]
    pub platform_usdc_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = recipient_usdc_account.mint == platform.usdc_mint
    )]
    pub recipient_usdc_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        constraint = fee_receiver.key() == platform.fee_receiver @ ZuviError::Unauthorized
    )]
    pub fee_receiver: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
    require!(amount > 0, ZuviError::InvalidWithdrawAmount);

    // 轉移費用
    let cpi_accounts = Transfer {
        from: ctx.accounts.platform_usdc_account.to_account_info(),
        to: ctx.accounts.recipient_usdc_account.to_account_info(),
        authority: ctx.accounts.fee_receiver.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    msg!("提取費用: {} USDC", amount);

    Ok(())
}
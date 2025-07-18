use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::errors::ZuviError;
use crate::state::Platform;

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(
        seeds = [b"platform"],
        bump = platform.bump,
        constraint = platform.authority == authority.key() @ ZuviError::Unauthorized
    )]
    pub platform: Account<'info, Platform>,

    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = platform_usdc_account.owner == platform.fee_receiver,
        constraint = platform_usdc_account.mint == platform.usdc_mint
    )]
    pub platform_usdc_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = recipient_usdc_account.mint == platform.usdc_mint
    )]
    pub recipient_usdc_account: Account<'info, TokenAccount>,

    /// CHECK: Fee receiver as signer
    #[account(
        constraint = fee_receiver.key() == platform.fee_receiver @ ZuviError::Unauthorized
    )]
    pub fee_receiver: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
    require!(amount > 0, ZuviError::InvalidWithdrawAmount);

    // 提取費用
    let cpi_accounts = Transfer {
        from: ctx.accounts.platform_usdc_account.to_account_info(),
        to: ctx.accounts.recipient_usdc_account.to_account_info(),
        authority: ctx.accounts.fee_receiver.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    msg!("Platform fees withdrawn successfully");
    msg!("Amount: {} USDC", amount);

    Ok(())
}
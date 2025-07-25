use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};
use crate::context::platform::*;
use crate::errors::ZuviError;

pub fn initialize(
    ctx: Context<InitializePlatform>,
    list_fee: u64,
    c_fee: u64,
    pay_fee: u64,
) -> Result<()> {
    let platform = &mut ctx.accounts.platform;

    require!(list_fee > 0, ZuviError::InvalidFeeAmount);
    require!(c_fee > 0, ZuviError::InvalidFeeAmount);
    require!(pay_fee > 0, ZuviError::InvalidFeeAmount);

    platform.authority = ctx.accounts.authority.key();
    platform.fee_receiver = ctx.accounts.fee_receiver.key();
    platform.usdc_mint = ctx.accounts.usdc_mint.key();
    platform.list_fee = list_fee;
    platform.c_fee = c_fee;
    platform.pay_fee = pay_fee;
    platform.is_initialized = true;
    platform.total_fees = 0;
    
    let (_, bump) = Pubkey::find_program_address(
        &[b"platform"],
        &crate::ID
    );
    platform.bump = bump;

    Ok(())
}

pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
    require!(amount > 0, ZuviError::InvalidWithdrawAmount);
    
    let balance = ctx.accounts.plat_usdc.amount;
    require!(balance >= amount, ZuviError::InsufficientBalance);

    let cpi_accounts = Transfer {
        from: ctx.accounts.plat_usdc.to_account_info(),
        to: ctx.accounts.recipient_usdc.to_account_info(),
        authority: ctx.accounts.fee_receiver.to_account_info(),
    };
    
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
        amount
    )?;

    Ok(())
}
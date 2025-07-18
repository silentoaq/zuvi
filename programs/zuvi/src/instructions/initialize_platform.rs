use anchor_lang::prelude::*;
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
    pub platform: Account<'info, Platform>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Fee receiver account
    pub fee_receiver: UncheckedAccount<'info>,

    /// CHECK: USDC mint account
    pub usdc_mint: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_platform(
    ctx: Context<InitializePlatform>,
    listing_fee: u64,
    contract_fee: u64,
    payment_fee: u64,
) -> Result<()> {
    let platform = &mut ctx.accounts.platform;

    // 驗證費用金額
    require!(listing_fee > 0, ZuviError::InvalidFeeAmount);
    require!(contract_fee > 0, ZuviError::InvalidFeeAmount);
    require!(payment_fee > 0, ZuviError::InvalidFeeAmount);

    // 初始化平台設定
    platform.authority = ctx.accounts.authority.key();
    platform.fee_receiver = ctx.accounts.fee_receiver.key();
    platform.listing_fee = listing_fee;
    platform.contract_fee = contract_fee;
    platform.payment_fee = payment_fee;
    platform.usdc_mint = ctx.accounts.usdc_mint.key();
    platform.is_initialized = true;
    platform.bump = ctx.bumps.platform;

    msg!("Platform initialized successfully");
    msg!("Listing fee: {} USDC", listing_fee);
    msg!("Contract fee: {} USDC", contract_fee);
    msg!("Payment fee: {} USDC", payment_fee);

    Ok(())
}
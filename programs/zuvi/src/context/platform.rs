use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use anchor_spl::token_interface::Mint;
use crate::state::Platform;
use crate::errors::ZuviError;

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
        constraint = plat_usdc.owner == platform.fee_receiver,
        constraint = plat_usdc.mint == platform.usdc_mint
    )]
    pub plat_usdc: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = recipient_usdc.mint == platform.usdc_mint
    )]
    pub recipient_usdc: InterfaceAccount<'info, TokenAccount>,

    #[account(
        constraint = fee_receiver.key() == platform.fee_receiver @ ZuviError::Unauthorized
    )]
    pub fee_receiver: Signer<'info>,

    pub token_program: Program<'info, Token>,
}
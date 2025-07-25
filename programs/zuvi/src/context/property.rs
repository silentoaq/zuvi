use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use anchor_spl::token_interface::TokenAccount;
use crate::state::{Platform, PropertyListing, ListingStatus};
use crate::errors::ZuviError;

#[derive(Accounts)]
#[instruction(attest_pda: Pubkey)]
pub struct ListProperty<'info> {
    #[account(
        seeds = [b"platform"],
        bump,
        constraint = platform.is_initialized @ ZuviError::PlatformNotInitialized
    )]
    pub platform: Box<Account<'info, Platform>>,

    #[account(
        init,
        payer = owner,
        space = PropertyListing::SIZE,
        seeds = [b"listing", attest_pda.as_ref()],
        bump
    )]
    pub listing: Box<Account<'info, PropertyListing>>,

    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        constraint = owner_usdc.owner == owner.key(),
        constraint = owner_usdc.mint == platform.usdc_mint
    )]
    pub owner_usdc: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = plat_usdc.owner == platform.fee_receiver,
        constraint = plat_usdc.mint == platform.usdc_mint
    )]
    pub plat_usdc: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct DelistProperty<'info> {
    #[account(
        mut,
        constraint = listing.owner == owner.key() @ ZuviError::NotPropertyOwner,
        constraint = listing.status == ListingStatus::Available @ ZuviError::InvalidListingStatus,
        close = owner
    )]
    pub listing: Box<Account<'info, PropertyListing>>,

    #[account(mut)]
    pub owner: Signer<'info>,
}
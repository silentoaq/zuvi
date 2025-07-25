use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use crate::state::{Platform, RentalContract, PaymentRecord, ContractStatus};
use crate::errors::ZuviError;

#[derive(Accounts)]
#[instruction(pay_month: String)]
pub struct PayRent<'info> {
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
        constraint = t_usdc.owner == tenant.key(),
        constraint = t_usdc.mint == platform.usdc_mint
    )]
    pub t_usdc: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = l_usdc.owner == contract.landlord,
        constraint = l_usdc.mint == platform.usdc_mint
    )]
    pub l_usdc: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = plat_usdc.owner == platform.fee_receiver,
        constraint = plat_usdc.mint == platform.usdc_mint
    )]
    pub plat_usdc: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = tenant,
        space = PaymentRecord::SIZE,
        seeds = [b"payment", contract.key().as_ref(), pay_month.as_bytes()],
        bump
    )]
    pub payment_record: Box<Account<'info, PaymentRecord>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}
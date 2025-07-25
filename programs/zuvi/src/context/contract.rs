use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use anchor_spl::token_interface::TokenAccount;
use crate::state::*;
use crate::errors::ZuviError;

#[derive(Accounts)]
pub struct CreateContract<'info> {
    #[account(
        mut,
        constraint = listing.owner == owner.key() @ ZuviError::NotPropertyOwner,
        constraint = listing.status == ListingStatus::Available @ ZuviError::InvalidListingStatus
    )]
    pub listing: Box<Account<'info, PropertyListing>>,

    #[account(
        constraint = application.listing == listing.key() @ ZuviError::InvalidApplicationStatus,
        constraint = application.status == ApplicationStatus::Accepted @ ZuviError::InvalidApplicationStatus
    )]
    pub application: Box<Account<'info, RentalApplication>>,

    #[account(
        init,
        payer = owner,
        space = RentalContract::SIZE,
        seeds = [b"contract", listing.key().as_ref(), application.applicant.as_ref()],
        bump
    )]
    pub contract: Box<Account<'info, RentalContract>>,

    #[account(
        init,
        payer = owner,
        space = EscrowAccount::SIZE,
        seeds = [b"escrow", contract.key().as_ref()],
        bump
    )]
    pub escrow: Box<Account<'info, EscrowAccount>>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct SignContract<'info> {
    #[account(
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Box<Account<'info, Platform>>,

    #[account(
        mut,
        constraint = listing.status == ListingStatus::Available @ ZuviError::InvalidListingStatus
    )]
    pub listing: Box<Account<'info, PropertyListing>>,

    #[account(
        mut,
        constraint = contract.tenant == tenant.key() @ ZuviError::NotContractParty,
        constraint = contract.status == ContractStatus::PendingSignature @ ZuviError::InvalidContractStatus
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

    #[account(mut)]
    pub escrow_usdc: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: 託管 PDA
    #[account(
        seeds = [b"escrow", contract.key().as_ref()],
        bump
    )]
    pub escrow_pda: UncheckedAccount<'info>,

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
        seeds = [b"payment", contract.key().as_ref(), b"initial"],
        bump
    )]
    pub payment_record: Box<Account<'info, PaymentRecord>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct TerminateContract<'info> {
    #[account(
        mut,
        constraint = listing.cur_contract == Some(contract.key()) @ ZuviError::InvalidContractStatus
    )]
    pub listing: Box<Account<'info, PropertyListing>>,

    #[account(
        mut,
        constraint = contract.status == ContractStatus::Active @ ZuviError::InvalidContractStatus,
        constraint = 
            contract.landlord == signer.key() || 
            contract.tenant == signer.key() 
            @ ZuviError::NotContractParty,
        close = signer
    )]
    pub contract: Box<Account<'info, RentalContract>>,

    #[account(
        mut,
        seeds = [b"escrow", contract.key().as_ref()],
        bump = escrow.bump,
        constraint = !escrow.refunded @ ZuviError::DepositAlreadyRefunded,
        close = signer
    )]
    pub escrow: Box<Account<'info, EscrowAccount>>,

    #[account(mut)]
    pub signer: Signer<'info>,

    /// CHECK: 託管代幣帳戶
    #[account(mut)]
    pub escrow_usdc: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = t_usdc.owner == contract.tenant
    )]
    pub t_usdc: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = signer,
        space = PaymentRecord::SIZE,
        seeds = [b"payment", contract.key().as_ref(), b"refund"],
        bump
    )]
    pub refund_record: Box<Account<'info, PaymentRecord>>,

    /// CHECK: 託管 PDA
    #[account(
        seeds = [b"escrow", contract.key().as_ref()],
        bump
    )]
    pub escrow_pda: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}
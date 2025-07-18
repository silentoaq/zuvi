use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use anchor_spl::token_interface::TokenAccount;
use crate::errors::ZuviError;
use crate::state::{
    PropertyListing, RentalContract, EscrowAccount, PaymentRecord,
    ContractStatus, ListingStatus, PaymentType
};

#[derive(Accounts)]
pub struct TerminateContract<'info> {
    #[account(
        mut,
        constraint = listing.current_contract == Some(contract.key()) @ ZuviError::InvalidContractStatus
    )]
    pub listing: Account<'info, PropertyListing>,

    #[account(
        mut,
        constraint = contract.status == ContractStatus::Active @ ZuviError::InvalidContractStatus,
        constraint = 
            contract.landlord == signer.key() || 
            contract.tenant == signer.key() 
            @ ZuviError::NotContractParty
    )]
    pub contract: Account<'info, RentalContract>,

    #[account(
        mut,
        seeds = [b"escrow", contract.key().as_ref()],
        bump = escrow_account.bump,
        constraint = !escrow_account.deposit_refunded @ ZuviError::DepositAlreadyRefunded
    )]
    pub escrow_account: Account<'info, EscrowAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    /// CHECK: Escrow token account
    #[account(mut)]
    pub escrow_token_account: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = tenant_usdc_account.owner == contract.tenant
    )]
    pub tenant_usdc_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = signer,
        space = PaymentRecord::SIZE,
        seeds = [b"payment", contract.key().as_ref(), b"refund"],
        bump
    )]
    pub refund_payment_record: Account<'info, PaymentRecord>,

    /// CHECK: 程式 PDA 用於簽名
    #[account(
        seeds = [b"escrow", contract.key().as_ref()],
        bump
    )]
    pub escrow_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn terminate_contract(ctx: Context<TerminateContract>, reason: String) -> Result<()> {
    let contract = &mut ctx.accounts.contract;
    let listing = &mut ctx.accounts.listing;
    let clock = &ctx.accounts.clock;
    
    // 先保存需要的值
    let escrow_key = ctx.accounts.escrow_account.key();
    let escrow_account = &mut ctx.accounts.escrow_account;

    // 驗證原因長度
    require!(reason.len() <= 256, ZuviError::StringTooLong);

    // 計算應退還的押金 (這裡簡化為全額退還，實際應用可能需要扣除損害)
    let refund_amount = escrow_account.deposit_amount;

    // 從託管賬戶退還押金給租客
    let escrow_contract_key = contract.key();
    let seeds = &[
        b"escrow",
        escrow_contract_key.as_ref(),
        &[ctx.bumps.escrow_authority],
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.escrow_token_account.to_account_info(),
        to: ctx.accounts.tenant_usdc_account.to_account_info(),
        authority: ctx.accounts.escrow_authority.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
    token::transfer(cpi_ctx, refund_amount)?;

    // 記錄退款
    let refund_record = &mut ctx.accounts.refund_payment_record;
    refund_record.contract = contract.key();
    refund_record.payment_type = PaymentType::DepositRefund;
    refund_record.amount = refund_amount;
    refund_record.payer = escrow_key;
    refund_record.receiver = contract.tenant;
    refund_record.payment_month = None;
    refund_record.paid_at = clock.unix_timestamp;
    refund_record.transaction_signature = ctx.accounts.signer.key().to_string();
    refund_record.bump = ctx.bumps.refund_payment_record;

    // 更新狀態
    contract.status = ContractStatus::Terminated;
    escrow_account.deposit_refunded = true;

    // 更新房源狀態
    listing.status = ListingStatus::Available;
    listing.current_tenant = None;
    listing.current_contract = None;

    msg!("Contract terminated successfully");
    msg!("Reason: {}", reason);
    msg!("Deposit refunded: {} USDC", refund_amount);

    Ok(())
}
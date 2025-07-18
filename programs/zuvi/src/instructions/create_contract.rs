use anchor_lang::prelude::*;
use crate::errors::ZuviError;
use crate::state::{
    PropertyListing, RentalApplication, RentalContract, EscrowAccount,
    ApplicationStatus, ContractStatus, ListingStatus
};

#[derive(Accounts)]
pub struct CreateContract<'info> {
    #[account(
        mut,
        constraint = listing.owner == owner.key() @ ZuviError::NotPropertyOwner,
        constraint = listing.status == ListingStatus::Available @ ZuviError::InvalidListingStatus
    )]
    pub listing: Account<'info, PropertyListing>,

    #[account(
        constraint = application.listing == listing.key() @ ZuviError::InvalidApplicationStatus,
        constraint = application.status == ApplicationStatus::Accepted @ ZuviError::InvalidApplicationStatus
    )]
    pub application: Account<'info, RentalApplication>,

    #[account(
        init,
        payer = owner,
        space = RentalContract::SIZE,
        seeds = [b"contract", listing.key().as_ref(), application.applicant.as_ref()],
        bump
    )]
    pub contract: Account<'info, RentalContract>,

    #[account(
        init,
        payer = owner,
        space = EscrowAccount::SIZE,
        seeds = [b"escrow", contract.key().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn create_contract(
    ctx: Context<CreateContract>,
    start_date: i64,
    end_date: i64,
    payment_day: u8,
    contract_hash: String,
) -> Result<()> {
    let listing = &ctx.accounts.listing;
    let application = &ctx.accounts.application;
    let contract = &mut ctx.accounts.contract;
    let escrow_account = &mut ctx.accounts.escrow_account;
    let clock = &ctx.accounts.clock;

    // 驗證合約參數
    require!(payment_day >= 1 && payment_day <= 28, ZuviError::InvalidPaymentDay);
    require!(start_date > clock.unix_timestamp, ZuviError::ContractStartDateMustBeFuture);
    require!(end_date > start_date, ZuviError::ContractEndDateMustBeAfterStart);
    require!(contract_hash.len() <= 64, ZuviError::StringTooLong);

    // 計算押金金額
    let deposit_amount = listing.monthly_rent
        .checked_mul(listing.deposit_months as u64)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    // 初始化合約
    contract.listing = listing.key();
    contract.landlord = listing.owner;
    contract.tenant = application.applicant;
    contract.monthly_rent = listing.monthly_rent;
    contract.deposit_amount = deposit_amount;
    contract.start_date = start_date;
    contract.end_date = end_date;
    contract.payment_day = payment_day;
    contract.contract_hash = contract_hash;
    contract.escrow_account = escrow_account.key();
    contract.status = ContractStatus::PendingSignature;
    contract.paid_months = 0;
    contract.created_at = clock.unix_timestamp;
    contract.bump = ctx.bumps.contract;

    // 初始化託管賬戶
    escrow_account.contract = contract.key();
    escrow_account.deposit_amount = deposit_amount;
    escrow_account.deposit_refunded = false;
    escrow_account.bump = ctx.bumps.escrow_account;

    msg!("Contract created successfully");
    msg!("Contract: {}", contract.key());
    msg!("Monthly rent: {} USDC", contract.monthly_rent);
    msg!("Deposit: {} USDC", contract.deposit_amount);
    msg!("Duration: {} to {}", start_date, end_date);

    Ok(())
}
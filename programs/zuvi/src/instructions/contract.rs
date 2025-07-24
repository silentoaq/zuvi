use anchor_lang::prelude::*;
use anchor_lang::emit;
use anchor_spl::token_interface::TokenAccount;
use anchor_spl::token::{self, Token, Transfer};
use crate::errors::ZuviError;
use crate::state::*;
use crate::events::ContractSigned;

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
    pub escrow_account: Box<Account<'info, EscrowAccount>>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn create(
    ctx: Context<CreateContract>,
    start_date: i64,
    end_date: i64,
    payment_day: u8,
    contract_hash: String,
) -> Result<()> {
    let listing = &*ctx.accounts.listing;
    let application = &*ctx.accounts.application;
    let contract = &mut *ctx.accounts.contract;
    let escrow_account = &mut *ctx.accounts.escrow_account;
    let clock = &ctx.accounts.clock;

    // 驗證
    require!(payment_day >= 1 && payment_day <= 28, ZuviError::InvalidPaymentDay);
    require!(start_date > clock.unix_timestamp, ZuviError::ContractStartDateMustBeFuture);
    require!(end_date > start_date, ZuviError::ContractEndDateMustBeAfterStart);
    require!(contract_hash.len() <= 64, ZuviError::StringTooLong);

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
    let (_, contract_bump) = Pubkey::find_program_address(
        &[b"contract", listing.key().as_ref(), application.applicant.as_ref()],
        &crate::ID
    );
    contract.bump = contract_bump;

    // 初始化託管
    escrow_account.contract = contract.key();
    escrow_account.deposit_amount = deposit_amount;
    escrow_account.deposit_refunded = false;
    let (_, escrow_bump) = Pubkey::find_program_address(
        &[b"escrow", contract.key().as_ref()],
        &crate::ID
    );
    escrow_account.bump = escrow_bump;

    msg!("合約已創建");

    Ok(())
}

#[derive(Accounts)]
pub struct SignContractAndPay<'info> {
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
        constraint = tenant_usdc_account.owner == tenant.key(),
        constraint = tenant_usdc_account.mint == platform.usdc_mint
    )]
    pub tenant_usdc_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = landlord_usdc_account.owner == contract.landlord,
        constraint = landlord_usdc_account.mint == platform.usdc_mint
    )]
    pub landlord_usdc_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub escrow_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: 託管 PDA
    #[account(
        seeds = [b"escrow", contract.key().as_ref()],
        bump
    )]
    pub escrow_pda: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = platform_usdc_account.owner == platform.fee_receiver,
        constraint = platform_usdc_account.mint == platform.usdc_mint
    )]
    pub platform_usdc_account: InterfaceAccount<'info, TokenAccount>,

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

pub fn sign_and_pay(ctx: Context<SignContractAndPay>) -> Result<()> {
    let platform = &ctx.accounts.platform;
    let contract = &mut *ctx.accounts.contract;
    let listing = &mut *ctx.accounts.listing;
    let clock = &ctx.accounts.clock;
    let payment_record = &mut *ctx.accounts.payment_record;

    let total_amount = contract.deposit_amount
        .checked_add(contract.monthly_rent)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    // 支付首月租金給房東
    let cpi_accounts = Transfer {
        from: ctx.accounts.tenant_usdc_account.to_account_info(),
        to: ctx.accounts.landlord_usdc_account.to_account_info(),
        authority: ctx.accounts.tenant.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
        contract.monthly_rent
    )?;

    // 支付押金到託管
    let cpi_accounts = Transfer {
        from: ctx.accounts.tenant_usdc_account.to_account_info(),
        to: ctx.accounts.escrow_token_account.to_account_info(),
        authority: ctx.accounts.tenant.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
        contract.deposit_amount
    )?;

    // 支付平台費
    let cpi_accounts = Transfer {
        from: ctx.accounts.tenant_usdc_account.to_account_info(),
        to: ctx.accounts.platform_usdc_account.to_account_info(),
        authority: ctx.accounts.tenant.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
        platform.contract_fee
    )?;

    // 更新狀態
    contract.status = ContractStatus::Active;
    contract.paid_months = 1;
    listing.status = ListingStatus::Rented;
    listing.current_contract = Some(contract.key());

    // 記錄支付
    payment_record.contract = contract.key();
    payment_record.payer = ctx.accounts.tenant.key();
    payment_record.recipient = contract.landlord;
    payment_record.amount = total_amount;
    payment_record.payment_type = PaymentType::FirstMonthRent;
    payment_record.payment_month = None;
    payment_record.timestamp = clock.unix_timestamp;
    let (_, bump) = Pubkey::find_program_address(
        &[b"payment", contract.key().as_ref(), b"initial"],
        &crate::ID
    );
    payment_record.bump = bump;

    // 發送事件
    emit!(ContractSigned {
        contract: contract.key(),
        landlord: contract.landlord,
        tenant: contract.tenant,
        total_payment: total_amount.checked_add(platform.contract_fee).unwrap(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct TerminateContract<'info> {
    #[account(
        mut,
        constraint = listing.current_contract == Some(contract.key()) @ ZuviError::InvalidContractStatus
    )]
    pub listing: Box<Account<'info, PropertyListing>>,

    #[account(
        mut,
        constraint = contract.status == ContractStatus::Active @ ZuviError::InvalidContractStatus,
        constraint = 
            contract.landlord == signer.key() || 
            contract.tenant == signer.key() 
            @ ZuviError::NotContractParty
    )]
    pub contract: Box<Account<'info, RentalContract>>,

    #[account(
        mut,
        seeds = [b"escrow", contract.key().as_ref()],
        bump = escrow_account.bump,
        constraint = !escrow_account.deposit_refunded @ ZuviError::DepositAlreadyRefunded
    )]
    pub escrow_account: Box<Account<'info, EscrowAccount>>,

    #[account(mut)]
    pub signer: Signer<'info>,

    /// CHECK: 託管代幣帳戶
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
    pub refund_payment_record: Box<Account<'info, PaymentRecord>>,

    /// CHECK: 託管 PDA
    #[account(
        seeds = [b"escrow", contract.key().as_ref()],
        bump
    )]
    pub escrow_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn terminate(ctx: Context<TerminateContract>, reason: String) -> Result<()> {
    let contract = &mut *ctx.accounts.contract;
    let listing = &mut *ctx.accounts.listing;
    let escrow_account = &mut *ctx.accounts.escrow_account;
    let clock = &ctx.accounts.clock;

    require!(reason.len() <= 256, ZuviError::StringTooLong);

    // 退還押金
    let contract_key = contract.key();
    let seeds = &[
        b"escrow".as_ref(),
        contract_key.as_ref(),
        &[escrow_account.bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.escrow_token_account.to_account_info(),
        to: ctx.accounts.tenant_usdc_account.to_account_info(),
        authority: ctx.accounts.escrow_authority.to_account_info(),
    };
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer
        ),
        escrow_account.deposit_amount
    )?;

    // 更新狀態
    escrow_account.deposit_refunded = true;
    contract.status = ContractStatus::Terminated;
    listing.status = ListingStatus::Available;
    listing.current_contract = None;

    // 記錄退款
    let refund_record = &mut *ctx.accounts.refund_payment_record;
    refund_record.contract = contract.key();
    refund_record.payer = ctx.accounts.escrow_authority.key();
    refund_record.recipient = contract.tenant;
    refund_record.amount = escrow_account.deposit_amount;
    refund_record.payment_type = PaymentType::DepositRefund;
    refund_record.payment_month = None;
    refund_record.timestamp = clock.unix_timestamp;
    let (_, bump) = Pubkey::find_program_address(
        &[b"payment", contract.key().as_ref(), b"refund"],
        &crate::ID
    );
    refund_record.bump = bump;

    msg!("合約終止: {}", reason);

    Ok(())
}
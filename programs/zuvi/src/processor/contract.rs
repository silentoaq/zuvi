use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};
use crate::context::contract::*;
use crate::state::{ContractStatus, ListingStatus, PaymentType};
use crate::errors::ZuviError;
use crate::events::ContractSigned;

pub fn create(
    ctx: Context<CreateContract>,
    start: i64,
    end: i64,
    pay_day: u8,
    c_hash: String,
) -> Result<()> {
    let listing = &ctx.accounts.listing;
    let application = &ctx.accounts.application;
    let contract = &mut ctx.accounts.contract;
    let escrow = &mut ctx.accounts.escrow;
    let clock = &ctx.accounts.clock;

    require!(pay_day >= 1 && pay_day <= 28, ZuviError::InvalidPaymentDay);
    require!(start > clock.unix_timestamp, ZuviError::ContractStartDateMustBeFuture);
    require!(end > start, ZuviError::ContractEndDateMustBeAfterStart);
    require!(c_hash.len() <= 64, ZuviError::StringTooLong);

    // 使用協商後的押金金額
    let deposit = application.offer_deposit;

    contract.listing = listing.key();
    contract.landlord = listing.owner;
    contract.tenant = application.applicant;
    contract.m_rent = application.offer_rent;      
    contract.deposit = deposit;   // 統一使用協商後的押金
    contract.start = start;
    contract.end = end;
    contract.pay_day = pay_day;
    contract.c_hash = c_hash;
    contract.escrow = escrow.key();
    contract.status = ContractStatus::PendingSignature;
    contract.paid_m = 0;
    contract.created = clock.unix_timestamp;
    
    let (_, contract_bump) = Pubkey::find_program_address(
        &[b"contract", listing.key().as_ref(), application.applicant.as_ref()],
        &crate::ID
    );
    contract.bump = contract_bump;

    escrow.contract = contract.key();
    escrow.deposit = deposit;  // 統一使用協商後的押金
    escrow.refunded = false;
    
    let (_, escrow_bump) = Pubkey::find_program_address(
        &[b"escrow", contract.key().as_ref()],
        &crate::ID
    );
    escrow.bump = escrow_bump;

    Ok(())
}

pub fn sign_contract(ctx: Context<SignContract>) -> Result<()> {
    let platform = &ctx.accounts.platform;
    let contract = &mut ctx.accounts.contract;
    let listing = &mut ctx.accounts.listing;
    let clock = &ctx.accounts.clock;
    let payment_record = &mut ctx.accounts.payment_record;

    let total_amount = contract.deposit
        .checked_add(contract.m_rent)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    // 支付首月租金給房東
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.t_usdc.to_account_info(),
                to: ctx.accounts.l_usdc.to_account_info(),
                authority: ctx.accounts.tenant.to_account_info(),
            }
        ),
        contract.m_rent
    )?;

    // 支付押金到託管
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.t_usdc.to_account_info(),
                to: ctx.accounts.escrow_usdc.to_account_info(),
                authority: ctx.accounts.tenant.to_account_info(),
            }
        ),
        contract.deposit
    )?;

    // 支付平台費
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.t_usdc.to_account_info(),
                to: ctx.accounts.plat_usdc.to_account_info(),
                authority: ctx.accounts.tenant.to_account_info(),
            }
        ),
        platform.c_fee
    )?;

    // 更新狀態
    contract.status = ContractStatus::Active;
    contract.paid_m = 1;
    listing.status = ListingStatus::Rented;
    listing.cur_contract = Some(contract.key());

    // 記錄支付
    payment_record.contract = contract.key();
    payment_record.payer = ctx.accounts.tenant.key();
    payment_record.recipient = contract.landlord;
    payment_record.amount = total_amount.checked_add(platform.c_fee).unwrap();
    payment_record.pay_type = PaymentType::FirstMonthRent;
    payment_record.pay_month = Some("Initial".to_string());
    payment_record.tx_time = clock.unix_timestamp;
    
    let (_, bump) = Pubkey::find_program_address(
        &[b"payment", contract.key().as_ref(), b"initial"],
        &crate::ID
    );
    payment_record.bump = bump;

    emit!(ContractSigned {
        contract: contract.key(),
        landlord: contract.landlord,
        tenant: contract.tenant,
        total_payment: payment_record.amount,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

pub fn terminate(ctx: Context<TerminateContract>, reason: String) -> Result<()> {
    let contract = &ctx.accounts.contract;
    let listing = &mut ctx.accounts.listing;
    let clock = &ctx.accounts.clock;

    require!(reason.len() <= 256, ZuviError::StringTooLong);

    // 退還押金 - 使用 contract.deposit 而不是 escrow.deposit
    let contract_key = contract.key();
    let escrow_bump = ctx.bumps.escrow_pda;
    let seeds = &[
        b"escrow".as_ref(),
        contract_key.as_ref(),
        &[escrow_bump],
    ];
    let signer = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_usdc.to_account_info(),
                to: ctx.accounts.t_usdc.to_account_info(),
                authority: ctx.accounts.escrow_pda.to_account_info(),
            },
            signer
        ),
        contract.deposit  // 使用 contract.deposit 確保金額一致
    )?;

    // 更新房源狀態
    listing.status = ListingStatus::Available;
    listing.cur_contract = None;

    // 記錄退款
    let refund_record = &mut ctx.accounts.refund_record;
    refund_record.contract = contract.key();
    refund_record.payer = ctx.accounts.escrow_pda.key();
    refund_record.recipient = contract.tenant;
    refund_record.amount = contract.deposit;  // 使用 contract.deposit
    refund_record.pay_type = PaymentType::DepositRefund;
    refund_record.pay_month = None;
    refund_record.tx_time = clock.unix_timestamp;
    
    let (_, bump) = Pubkey::find_program_address(
        &[b"payment", contract.key().as_ref(), b"refund"],
        &crate::ID
    );
    refund_record.bump = bump;

    msg!("合約終止: {}", reason);

    Ok(())
}
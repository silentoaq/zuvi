use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};
use crate::context::payment::*;
use crate::state::PaymentType;
use crate::errors::ZuviError;
use crate::events::RentPaid;

pub fn pay_rent(
    ctx: Context<PayRent>,
    pay_month: String,
) -> Result<()> {
    let platform = &ctx.accounts.platform;
    let contract = &mut ctx.accounts.contract;
    let clock = &ctx.accounts.clock;

    require!(
        clock.unix_timestamp >= contract.start,
        ZuviError::ContractNotStarted
    );
    require!(
        clock.unix_timestamp <= contract.end,
        ZuviError::ContractEnded
    );
    require!(pay_month.len() <= 20, ZuviError::StringTooLong);

    // 支付租金給房東
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
        platform.pay_fee
    )?;

    // 更新支付月數
    contract.paid_m = contract.paid_m.saturating_add(1);

    // 記錄支付
    let payment_record = &mut ctx.accounts.payment_record;
    payment_record.contract = contract.key();
    payment_record.payer = ctx.accounts.tenant.key();
    payment_record.recipient = contract.landlord;
    payment_record.amount = contract.m_rent.checked_add(platform.pay_fee).unwrap();
    payment_record.pay_type = PaymentType::MonthlyRent;
    payment_record.pay_month = Some(pay_month.clone());
    payment_record.tx_time = clock.unix_timestamp;
    
    let (_, bump) = Pubkey::find_program_address(
        &[b"payment", contract.key().as_ref(), pay_month.as_bytes()],
        &crate::ID
    );
    payment_record.bump = bump;

    emit!(RentPaid {
        contract: contract.key(),
        tenant: ctx.accounts.tenant.key(),
        amount: contract.m_rent,
        pay_month: pay_month,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
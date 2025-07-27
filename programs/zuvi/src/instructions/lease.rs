use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::errors::ErrorCode;
use crate::events::{LeaseCreated, LeaseTerminated, RentPaid, RentOverdue};
use crate::state::{
    Application, Config, Escrow, Lease, Listing,
    APPLICATION_STATUS_APPROVED, ESCROW_STATUS_HOLDING, LEASE_STATUS_ACTIVE,
    LEASE_STATUS_TERMINATED, LISTING_STATUS_AVAILABLE, LISTING_STATUS_RENTED, 
    MAX_FUTURE_LEASE_DAYS, MAX_PAYMENT_DAY, MAX_OVERDUE_COUNT, 
    TERMINATION_MUTUAL, TERMINATION_LANDLORD_BREACH,
    TERMINATION_TENANT_BREACH, TERMINATION_OVERDUE_EXCEED
};

#[derive(Accounts)]
pub struct SignLease<'info> {
    #[account(
        seeds = [Config::SEED],
        bump,
        constraint = config.initialized @ ErrorCode::NotInitialized
    )]
    pub config: Account<'info, Config>,
    
    #[account(
        mut,
        seeds = [Listing::SEED, listing.property_attest.as_ref()],
        bump,
        constraint = listing.owner == landlord.key() @ ErrorCode::Unauthorized
    )]
    pub listing: Account<'info, Listing>,
    
    #[account(
        seeds = [Application::SEED, listing.key().as_ref(), tenant_attest.key().as_ref()],
        bump,
        constraint = application.status == APPLICATION_STATUS_APPROVED @ ErrorCode::ApplicationExpired,
        constraint = application.applicant == tenant.key() @ ErrorCode::Unauthorized
    )]
    pub application: Account<'info, Application>,
    
    #[account(
        init,
        payer = landlord, // 改由房東支付
        space = Lease::LEN,
        seeds = [Lease::SEED, listing.key().as_ref(), tenant_attest.key().as_ref()],
        bump
    )]
    pub lease: Account<'info, Lease>,
    
    #[account(
        init,
        payer = landlord, // 改由房東支付
        space = Escrow::LEN,
        seeds = [Escrow::SEED, lease.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    /// CHECK: 承租人憑證 PDA
    pub tenant_attest: AccountInfo<'info>,
    
    #[account(mut)]
    pub landlord: Signer<'info>,
    
    pub tenant: Signer<'info>,
    
    /// CHECK: API 簽名者，驗證憑證有效性
    #[account(
        constraint = api_signer.key() == config.api_signer @ ErrorCode::ApiSignatureRequired
    )]
    pub api_signer: Signer<'info>,
    
    // SPL Token 帳戶
    #[account(
        mut,
        constraint = tenant_token.owner == tenant.key(),
        constraint = tenant_token.mint == config.usdc_mint @ ErrorCode::InvalidCredential
    )]
    pub tenant_token: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = landlord_token.owner == landlord.key(),
        constraint = landlord_token.mint == config.usdc_mint @ ErrorCode::InvalidCredential
    )]
    pub landlord_token: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = escrow_token.owner == escrow.key(),
        constraint = escrow_token.mint == config.usdc_mint @ ErrorCode::InvalidCredential
    )]
    pub escrow_token: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = fee_receiver_token.owner == config.fee_receiver,
        constraint = fee_receiver_token.mint == config.usdc_mint @ ErrorCode::InvalidCredential
    )]
    pub fee_receiver_token: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PayRent<'info> {
    #[account(
        seeds = [Config::SEED],
        bump,
        constraint = config.initialized @ ErrorCode::NotInitialized
    )]
    pub config: Account<'info, Config>,
    
    #[account(
        mut,
        seeds = [Lease::SEED, lease.listing.as_ref(), lease.tenant_attest.as_ref()],
        bump,
        constraint = lease.status == LEASE_STATUS_ACTIVE @ ErrorCode::LeaseAlreadyTerminated,
        constraint = lease.tenant == tenant.key() @ ErrorCode::Unauthorized
    )]
    pub lease: Account<'info, Lease>,
    
    pub tenant: Signer<'info>,
    
    /// CHECK: 房東帳號，從 lease 取得
    #[account(
        constraint = landlord.key() == lease.landlord @ ErrorCode::Unauthorized
    )]
    pub landlord: AccountInfo<'info>,
    
    // SPL Token 帳戶
    #[account(
        mut,
        constraint = tenant_token.owner == tenant.key(),
        constraint = tenant_token.mint == config.usdc_mint @ ErrorCode::InvalidCredential
    )]
    pub tenant_token: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = landlord_token.owner == landlord.key(),
        constraint = landlord_token.mint == config.usdc_mint @ ErrorCode::InvalidCredential
    )]
    pub landlord_token: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = fee_receiver_token.owner == config.fee_receiver,
        constraint = fee_receiver_token.mint == config.usdc_mint @ ErrorCode::InvalidCredential
    )]
    pub fee_receiver_token: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TerminateLease<'info> {
    #[account(
        mut,
        seeds = [Lease::SEED, listing.key().as_ref(), lease.tenant_attest.as_ref()],
        bump,
        constraint = lease.status == LEASE_STATUS_ACTIVE @ ErrorCode::LeaseAlreadyTerminated
    )]
    pub lease: Account<'info, Lease>,
    
    #[account(
        mut,
        seeds = [Listing::SEED, listing.property_attest.as_ref()],
        bump,
        constraint = listing.key() == lease.listing @ ErrorCode::Unauthorized
    )]
    pub listing: Account<'info, Listing>,
    
    #[account(
        constraint = terminator.key() == lease.landlord || terminator.key() == lease.tenant @ ErrorCode::Unauthorized
    )]
    pub terminator: Signer<'info>,
}

pub fn sign_lease(
    ctx: Context<SignLease>,
    start_date: i64,
    end_date: i64,
    payment_day: u8,
    total_payments: u32,
) -> Result<()> {
    let lease = &mut ctx.accounts.lease;
    let listing = &mut ctx.accounts.listing;
    let escrow = &mut ctx.accounts.escrow;
    let config = &ctx.accounts.config;
    let clock = Clock::get()?;
    
    // 驗證參數
    require!(payment_day >= 1 && payment_day <= MAX_PAYMENT_DAY, ErrorCode::InvalidPaymentDay);
    require!(start_date > clock.unix_timestamp, ErrorCode::InvalidStartDate);
    require!(start_date < clock.unix_timestamp + MAX_FUTURE_LEASE_DAYS, ErrorCode::InvalidStartDate);
    require!(end_date > start_date, ErrorCode::InvalidStartDate);
    require!(total_payments > 0, ErrorCode::InvalidStartDate);
    
    // 初始化租約
    lease.listing = listing.key();
    lease.landlord = listing.owner;
    lease.tenant = ctx.accounts.tenant.key();
    lease.tenant_attest = ctx.accounts.tenant_attest.key();
    lease.start_date = start_date;
    lease.end_date = end_date;
    lease.rent = listing.rent;
    lease.deposit_paid = listing.deposit;
    lease.deposit_deducted = 0;
    lease.payment_day = payment_day;
    lease.grace_days = listing.grace_days;
    lease.total_payments = total_payments;
    lease.paid_payments = 1; // 第一期已支付
    lease.last_payment_date = clock.unix_timestamp;
    lease.last_payment_index = 0;
    lease.overdue_count = 0;
    lease.next_due_date = start_date; // 由客戶端計算下次到期日
    lease.dispute_count = 0;
    lease.status = LEASE_STATUS_ACTIVE;
    lease.termination_reason = None;
    lease.created_at = clock.unix_timestamp;
    lease.updated_at = clock.unix_timestamp;
    
    // 初始化押金託管
    escrow.lease = lease.key();
    escrow.amount = listing.deposit;
    escrow.deducted = 0;
    escrow.status = ESCROW_STATUS_HOLDING;
    escrow.has_dispute = false;
    escrow.settle_request = None;
    
    // 計算費用
    let platform_fee = (listing.rent * config.fee_rate as u64) / 10000;
    let landlord_amount = listing.rent - platform_fee;
    
    // 轉帳：押金到託管
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.tenant_token.to_account_info(),
                to: ctx.accounts.escrow_token.to_account_info(),
                authority: ctx.accounts.tenant.to_account_info(),
            },
        ),
        listing.deposit,
    )?;
    
    // 轉帳：第一期租金給房東
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.tenant_token.to_account_info(),
                to: ctx.accounts.landlord_token.to_account_info(),
                authority: ctx.accounts.tenant.to_account_info(),
            },
        ),
        landlord_amount,
    )?;
    
    // 轉帳：平台費
    if platform_fee > 0 {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.tenant_token.to_account_info(),
                    to: ctx.accounts.fee_receiver_token.to_account_info(),
                    authority: ctx.accounts.tenant.to_account_info(),
                },
            ),
            platform_fee,
        )?;
    }
    
    // 更新房源狀態
    listing.status = LISTING_STATUS_RENTED;
    listing.current_lease = Some(lease.key());
    listing.total_leases += 1;
    listing.updated_at = clock.unix_timestamp;
    
    emit!(LeaseCreated {
        lease: lease.key(),
        listing: listing.key(),
        landlord: lease.landlord,
        tenant: lease.tenant,
        start_date,
        end_date,
        payment_day,
    });
    
    Ok(())
}

pub fn pay_rent(
    ctx: Context<PayRent>, 
    payment_index: u32,
    next_due_date: i64,
) -> Result<()> {
    let lease = &mut ctx.accounts.lease;
    let config = &ctx.accounts.config;
    let clock = Clock::get()?;
    
    // 驗證支付序號
    require!(payment_index == lease.last_payment_index + 1, ErrorCode::PaymentAlreadyExists);
    require!(payment_index < lease.total_payments, ErrorCode::PaymentNotFound);
    
    // 檢查是否逾期
    let is_overdue = clock.unix_timestamp > lease.next_due_date + (lease.grace_days as i64 * 86400);
    if is_overdue {
        lease.overdue_count += 1;
        
        // 檢查是否超過逾期上限
        if lease.overdue_count >= MAX_OVERDUE_COUNT {
            emit!(RentOverdue {
                lease: lease.key(),
                payment_index,
                overdue_count: lease.overdue_count,
            });
            return Err(ErrorCode::ExceedOverdueLimit.into());
        }
        
        emit!(RentOverdue {
            lease: lease.key(),
            payment_index,
            overdue_count: lease.overdue_count,
        });
    }
    
    // 計算費用
    let platform_fee = (lease.rent * config.fee_rate as u64) / 10000;
    let landlord_amount = lease.rent - platform_fee;
    
    // 轉帳：租金給房東
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.tenant_token.to_account_info(),
                to: ctx.accounts.landlord_token.to_account_info(),
                authority: ctx.accounts.tenant.to_account_info(),
            },
        ),
        landlord_amount,
    )?;
    
    // 轉帳：平台費
    if platform_fee > 0 {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.tenant_token.to_account_info(),
                    to: ctx.accounts.fee_receiver_token.to_account_info(),
                    authority: ctx.accounts.tenant.to_account_info(),
                },
            ),
            platform_fee,
        )?;
    }
    
    // 更新租約
    lease.paid_payments += 1;
    lease.last_payment_date = clock.unix_timestamp;
    lease.last_payment_index = payment_index;
    lease.next_due_date = next_due_date;
    lease.updated_at = clock.unix_timestamp;
    
    emit!(RentPaid {
        lease: lease.key(),
        payment_index,
        amount: lease.rent,
        paid_date: clock.unix_timestamp,
    });
    
    Ok(())
}

pub fn terminate_lease(ctx: Context<TerminateLease>, reason: u8) -> Result<()> {
    let lease = &mut ctx.accounts.lease;
    let listing = &mut ctx.accounts.listing;
    let clock = Clock::get()?;
    
    // 驗證終止原因
    require!(
        reason == TERMINATION_MUTUAL ||
        reason == TERMINATION_LANDLORD_BREACH ||
        reason == TERMINATION_TENANT_BREACH ||
        reason == TERMINATION_OVERDUE_EXCEED,
        ErrorCode::InvalidTerminationReason
    );
    
    // 更新租約狀態
    lease.status = LEASE_STATUS_TERMINATED;
    lease.termination_reason = Some(reason);
    lease.updated_at = clock.unix_timestamp;
    
    // 更新房源狀態
    listing.status = LISTING_STATUS_AVAILABLE;
    listing.current_lease = None;
    listing.updated_at = clock.unix_timestamp;
    
    emit!(LeaseTerminated {
        lease: lease.key(),
        reason,
        terminator: ctx.accounts.terminator.key(),
    });
    
    Ok(())
}
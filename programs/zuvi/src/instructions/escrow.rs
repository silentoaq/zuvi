use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::errors::ErrorCode;
use crate::events::{SettleRequested, SettleConfirmed};
use crate::state::{
    Config, Escrow, Lease, SettleRequest,
    ESCROW_STATUS_HOLDING, ESCROW_STATUS_SETTLING, ESCROW_STATUS_SETTLED,
    LEASE_STATUS_TERMINATED
};

#[derive(Accounts)]
pub struct RequestSettle<'info> {
    #[account(
        mut,
        seeds = [Escrow::SEED, lease.key().as_ref()],
        bump,
        constraint = escrow.status == ESCROW_STATUS_HOLDING @ ErrorCode::EscrowAlreadySettled,
        constraint = !escrow.has_dispute @ ErrorCode::DisputeInProgress
    )]
    pub escrow: Account<'info, Escrow>,
    
    #[account(
        seeds = [Lease::SEED, lease.listing.as_ref(), lease.tenant_attest.as_ref()],
        bump,
        constraint = lease.status == LEASE_STATUS_TERMINATED @ ErrorCode::LeaseNotFound,
        constraint = lease.landlord == landlord.key() @ ErrorCode::Unauthorized
    )]
    pub lease: Account<'info, Lease>,
    
    pub landlord: Signer<'info>,
}

#[derive(Accounts)]
pub struct ConfirmSettle<'info> {
    #[account(
        seeds = [Config::SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    
    #[account(
        mut,
        seeds = [Escrow::SEED, lease.key().as_ref()],
        bump,
        constraint = escrow.status == ESCROW_STATUS_SETTLING @ ErrorCode::SettleRequestNotFound,
        constraint = escrow.settle_request.is_some() @ ErrorCode::SettleRequestNotFound
    )]
    pub escrow: Account<'info, Escrow>,
    
    #[account(
        seeds = [Lease::SEED, lease.listing.as_ref(), lease.tenant_attest.as_ref()],
        bump,
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
        constraint = escrow_token.owner == escrow.key(),
        constraint = escrow_token.mint == config.usdc_mint @ ErrorCode::InvalidCredential
    )]
    pub escrow_token: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = landlord_token.owner == landlord.key(),
        constraint = landlord_token.mint == config.usdc_mint @ ErrorCode::InvalidCredential
    )]
    pub landlord_token: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = tenant_token.owner == tenant.key(),
        constraint = tenant_token.mint == config.usdc_mint @ ErrorCode::InvalidCredential
    )]
    pub tenant_token: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ForceSettle<'info> {
    #[account(
        seeds = [Config::SEED],
        bump,
        constraint = config.arbitrator == arbitrator.key() @ ErrorCode::Unauthorized
    )]
    pub config: Account<'info, Config>,
    
    #[account(
        mut,
        seeds = [Escrow::SEED, lease.key().as_ref()],
        bump,
        constraint = escrow.status == ESCROW_STATUS_SETTLING @ ErrorCode::EscrowAlreadySettled
    )]
    pub escrow: Account<'info, Escrow>,
    
    #[account(
        seeds = [Lease::SEED, lease.listing.as_ref(), lease.tenant_attest.as_ref()],
        bump
    )]
    pub lease: Account<'info, Lease>,
    
    pub arbitrator: Signer<'info>,
    
    /// CHECK: 房東帳號，從 lease 取得
    #[account(
        constraint = landlord.key() == lease.landlord @ ErrorCode::Unauthorized
    )]
    pub landlord: AccountInfo<'info>,
    
    /// CHECK: 承租人帳號，從 lease 取得
    #[account(
        constraint = tenant.key() == lease.tenant @ ErrorCode::Unauthorized
    )]
    pub tenant: AccountInfo<'info>,
    
    // SPL Token 帳戶
    #[account(
        mut,
        constraint = escrow_token.owner == escrow.key(),
        constraint = escrow_token.mint == config.usdc_mint @ ErrorCode::InvalidCredential
    )]
    pub escrow_token: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = landlord_token.owner == landlord.key(),
        constraint = landlord_token.mint == config.usdc_mint @ ErrorCode::InvalidCredential
    )]
    pub landlord_token: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = tenant_token.owner == tenant.key(),
        constraint = tenant_token.mint == config.usdc_mint @ ErrorCode::InvalidCredential
    )]
    pub tenant_token: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

pub fn request_settle(
    ctx: Context<RequestSettle>,
    total_deductions: u64,
    deduction_count: u8,
) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    let clock = Clock::get()?;
    
    // 驗證扣款金額
    require!(total_deductions <= escrow.amount, ErrorCode::DeductionExceedsDeposit);
    
    // 創建結算請求
    escrow.settle_request = Some(SettleRequest {
        initiator: ctx.accounts.landlord.key(),
        total_deductions,
        deduction_count,
        created_at: clock.unix_timestamp,
        tenant_confirmed: false,
    });
    escrow.status = ESCROW_STATUS_SETTLING;
    
    emit!(SettleRequested {
        escrow: ctx.accounts.escrow.key(),
        lease: ctx.accounts.lease.key(),
        total_deductions,
    });
    
    Ok(())
}

pub fn confirm_settle(ctx: Context<ConfirmSettle>) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    
    // 取得結算請求
    let settle_request = escrow.settle_request.as_ref()
        .ok_or(ErrorCode::SettleRequestNotFound)?;
    
    // 確認尚未確認
    require!(!settle_request.tenant_confirmed, ErrorCode::SettleAlreadyConfirmed);
    
    // 計算分配金額
    let landlord_amount = settle_request.total_deductions;
    let tenant_amount = escrow.amount - settle_request.total_deductions;
    
    // 轉帳給房東
    if landlord_amount > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token.to_account_info(),
                    to: ctx.accounts.landlord_token.to_account_info(),
                    authority: escrow.to_account_info(),
                },
                &[&[
                    Escrow::SEED,
                    ctx.accounts.lease.key().as_ref(),
                    &[ctx.bumps.escrow],
                ]],
            ),
            landlord_amount,
        )?;
    }
    
    // 轉帳給承租人
    if tenant_amount > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token.to_account_info(),
                    to: ctx.accounts.tenant_token.to_account_info(),
                    authority: escrow.to_account_info(),
                },
                &[&[
                    Escrow::SEED,
                    ctx.accounts.lease.key().as_ref(),
                    &[ctx.bumps.escrow],
                ]],
            ),
            tenant_amount,
        )?;
    }
    
    // 更新狀態
    let total_deductions = settle_request.total_deductions;
    escrow.status = ESCROW_STATUS_SETTLED;
    escrow.deducted = total_deductions;
    if let Some(ref mut request) = escrow.settle_request {
        request.tenant_confirmed = true;
    }
    
    emit!(SettleConfirmed {
        escrow: ctx.accounts.escrow.key(),
        lease: ctx.accounts.lease.key(),
        landlord_amount,
        tenant_amount,
    });
    
    Ok(())
}

pub fn force_settle(ctx: Context<ForceSettle>) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    
    // 取得結算請求
    let settle_request = escrow.settle_request.as_ref()
        .ok_or(ErrorCode::SettleRequestNotFound)?;
    
    // 計算分配金額
    let landlord_amount = settle_request.total_deductions;
    let tenant_amount = escrow.amount - settle_request.total_deductions;
    
    // 轉帳給房東
    if landlord_amount > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token.to_account_info(),
                    to: ctx.accounts.landlord_token.to_account_info(),
                    authority: escrow.to_account_info(),
                },
                &[&[
                    Escrow::SEED,
                    ctx.accounts.lease.key().as_ref(),
                    &[ctx.bumps.escrow],
                ]],
            ),
            landlord_amount,
        )?;
    }
    
    // 轉帳給承租人
    if tenant_amount > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token.to_account_info(),
                    to: ctx.accounts.tenant_token.to_account_info(),
                    authority: escrow.to_account_info(),
                },
                &[&[
                    Escrow::SEED,
                    ctx.accounts.lease.key().as_ref(),
                    &[ctx.bumps.escrow],
                ]],
            ),
            tenant_amount,
        )?;
    }
    
    // 更新狀態
    let total_deductions = settle_request.total_deductions;
    escrow.status = ESCROW_STATUS_SETTLED;
    escrow.deducted = total_deductions;
    
    emit!(SettleConfirmed {
        escrow: ctx.accounts.escrow.key(),
        lease: ctx.accounts.lease.key(),
        landlord_amount,
        tenant_amount,
    });
    
    Ok(())
}
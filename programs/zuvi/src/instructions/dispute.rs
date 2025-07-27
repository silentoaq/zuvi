use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::errors::ErrorCode;
use crate::events::{DisputeCreated, DisputeResolved};
use crate::state::{
    Config, Dispute, Escrow, Lease,
    DISPUTE_STATUS_PENDING, DISPUTE_STATUS_RESOLVED,
    DISPUTE_DEPOSIT, DISPUTE_DAMAGE, DISPUTE_OTHER
};

#[derive(Accounts)]
#[instruction(dispute_id: u32)]
pub struct CreateDispute<'info> {
    #[account(
        seeds = [Lease::SEED, lease.listing.as_ref(), lease.tenant_attest.as_ref()],
        bump
    )]
    pub lease: Account<'info, Lease>,
    
    #[account(
        mut,
        seeds = [Escrow::SEED, lease.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    #[account(
        init,
        payer = initiator,
        space = Dispute::LEN,
        seeds = [Dispute::SEED, lease.key().as_ref(), &dispute_id.to_le_bytes()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,
    
    #[account(
        mut,
        constraint = initiator.key() == lease.landlord || initiator.key() == lease.tenant @ ErrorCode::Unauthorized
    )]
    pub initiator: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(dispute_id: u32)]
pub struct ResolveDispute<'info> {
    #[account(
        seeds = [Config::SEED],
        bump,
        constraint = config.arbitrator == arbitrator.key() @ ErrorCode::Unauthorized
    )]
    pub config: Account<'info, Config>,
    
    #[account(
        mut,
        seeds = [Dispute::SEED, lease.key().as_ref(), &dispute_id.to_le_bytes()],
        bump,
        constraint = dispute.status == DISPUTE_STATUS_PENDING @ ErrorCode::DisputeAlreadyResolved
    )]
    pub dispute: Account<'info, Dispute>,
    
    #[account(
        seeds = [Lease::SEED, lease.listing.as_ref(), lease.tenant_attest.as_ref()],
        bump
    )]
    pub lease: Account<'info, Lease>,
    
    #[account(
        mut,
        seeds = [Escrow::SEED, lease.key().as_ref()],
        bump,
        constraint = escrow.has_dispute @ ErrorCode::DisputeNotFound
    )]
    pub escrow: Account<'info, Escrow>,
    
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

pub fn create_dispute(
    ctx: Context<CreateDispute>, 
    reason: u8
) -> Result<()> {
    let dispute = &mut ctx.accounts.dispute;
    let lease = &mut ctx.accounts.lease;
    let escrow = &mut ctx.accounts.escrow;
    let clock = Clock::get()?;
    
    // 驗證爭議原因
    require!(
        reason == DISPUTE_DEPOSIT ||
        reason == DISPUTE_DAMAGE ||
        reason == DISPUTE_OTHER,
        ErrorCode::InvalidDisputeReason
    );
    
    // 初始化爭議
    dispute.lease = lease.key();
    dispute.initiator = ctx.accounts.initiator.key();
    dispute.reason = reason;
    dispute.status = DISPUTE_STATUS_PENDING;
    dispute.resolution = None;
    dispute.deposit_distribution = None;
    dispute.created_at = clock.unix_timestamp;
    dispute.resolved_at = None;
    
    // 更新租約和託管狀態
    lease.dispute_count += 1;
    escrow.has_dispute = true;
    
    emit!(DisputeCreated {
        dispute: ctx.accounts.dispute.key(),
        lease: lease.key(),
        initiator: ctx.accounts.initiator.key(),
        reason,
    });
    
    Ok(())
}

pub fn resolve_dispute(
    ctx: Context<ResolveDispute>,
    _dispute_id: u32,
    resolution: String,
    landlord_amount: u64,
    tenant_amount: u64,
) -> Result<()> {
    let dispute = &mut ctx.accounts.dispute;
    let escrow = &mut ctx.accounts.escrow;
    let clock = Clock::get()?;
    
    // 驗證分配金額
    require!(
        landlord_amount + tenant_amount == escrow.amount,
        ErrorCode::InvalidDistribution
    );
    
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
    
    // 更新爭議狀態
    dispute.status = DISPUTE_STATUS_RESOLVED;
    dispute.resolution = Some(resolution.clone());
    dispute.deposit_distribution = Some((landlord_amount, tenant_amount));
    dispute.resolved_at = Some(clock.unix_timestamp);
    
    // 更新託管狀態
    escrow.has_dispute = false;
    escrow.deducted = landlord_amount;
    
    emit!(DisputeResolved {
        dispute: ctx.accounts.dispute.key(),
        resolution,
        landlord_amount,
        tenant_amount,
    });
    
    Ok(())
}
use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, state::*};

/// 發起爭議
pub fn raise_dispute(ctx: Context<RaiseDispute>, reason: u8) -> Result<()> {
    let lease = &ctx.accounts.lease;
    let escrow = &mut ctx.accounts.escrow;
    let dispute = &mut ctx.accounts.dispute;
    let initiator = &ctx.accounts.initiator;
    let clock = Clock::get()?;
    
    // 確認是租約當事人
    require!(
        initiator.key() == lease.landlord || initiator.key() == lease.tenant,
        ZuviError::Unauthorized
    );
    
    // 驗證爭議原因
    require!(
        reason == DISPUTE_REASON_DEPOSIT || reason == DISPUTE_REASON_OTHER,
        ZuviError::InvalidDisputeReason
    );
    
    // 確認押金尚未釋放
    require!(
        escrow.status != ESCROW_STATUS_RELEASED,
        ZuviError::DepositAlreadyReleased
    );
    
    // 設定爭議資料
    dispute.lease = lease.key();
    dispute.initiator = initiator.key();
    dispute.reason = reason;
    dispute.status = DISPUTE_STATUS_OPEN;
    dispute.created_at = clock.unix_timestamp;
    
    // 標記 Escrow 有爭議
    escrow.has_dispute = true;
    
    msg!("爭議已發起");
    msg!("發起人: {}", initiator.key());
    msg!("原因: {}", if reason == DISPUTE_REASON_DEPOSIT { "押金爭議" } else { "其他" });
    
    Ok(())
}

#[derive(Accounts)]
pub struct RaiseDispute<'info> {
    /// 租約
    #[account(
        seeds = [LEASE_SEED, lease.listing.as_ref(), lease.tenant.as_ref()],
        bump
    )]
    pub lease: Account<'info, Lease>,
    
    /// 押金託管帳戶
    #[account(
        mut,
        seeds = [ESCROW_SEED, lease.key().as_ref()],
        bump,
        constraint = escrow.lease == lease.key()
    )]
    pub escrow: Account<'info, Escrow>,
    
    /// 爭議帳戶
    #[account(
        init,
        payer = initiator,
        space = DISPUTE_SIZE,
        seeds = [DISPUTE_SEED, lease.key().as_ref()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,
    
    /// 發起人（房東或承租人）
    #[account(mut)]
    pub initiator: Signer<'info>,
    
    /// 系統程式
    pub system_program: Program<'info, System>,
}
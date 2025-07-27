use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, state::*};

/// 發起押金結算
pub fn initiate_release(
    ctx: Context<InitiateRelease>,
    landlord_amount: u64,
    tenant_amount: u64,
) -> Result<()> {
    let lease = &ctx.accounts.lease;
    let escrow = &mut ctx.accounts.escrow;
    let signer = &ctx.accounts.signer;
    
    // 確認是租約當事人
    require!(
        signer.key() == lease.landlord || signer.key() == lease.tenant,
        ZuviError::Unauthorized
    );
    
    // 確認押金尚未釋放
    require!(
        escrow.status == ESCROW_STATUS_HOLDING,
        ZuviError::DepositAlreadyReleased
    );
    
    // 確認沒有爭議
    require!(
        !escrow.has_dispute,
        ZuviError::DisputeInProgress
    );
    
    // 確認金額總和正確
    let total = landlord_amount + tenant_amount;
    require!(
        total == escrow.amount,
        ZuviError::AmountMismatch
    );
    
    // 設定分配方案
    escrow.status = ESCROW_STATUS_RELEASING;
    escrow.release_to_landlord = landlord_amount;
    escrow.release_to_tenant = tenant_amount;
    
    // 設定發起人的簽署狀態
    if signer.key() == lease.landlord {
        escrow.landlord_signed = true;
        escrow.tenant_signed = false;
    } else {
        escrow.landlord_signed = false;
        escrow.tenant_signed = true;
    }
    
    msg!("押金結算已發起");
    msg!("房東分配: {} USDC", landlord_amount);
    msg!("承租人分配: {} USDC", tenant_amount);
    msg!("等待另一方確認");
    
    Ok(())
}

#[derive(Accounts)]
pub struct InitiateRelease<'info> {
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
    
    /// 發起人（房東或承租人）
    pub signer: Signer<'info>,
}
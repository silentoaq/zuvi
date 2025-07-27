use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use anchor_spl::token_interface::TokenAccount;
use crate::{constants::*, errors::*, state::*};

/// 解決爭議（仲裁者裁決）
pub fn resolve_dispute(
    ctx: Context<ResolveDispute>,
    landlord_amount: u64,
    tenant_amount: u64,
) -> Result<()> {
    let config = &ctx.accounts.config;
    let lease = &ctx.accounts.lease;
    let escrow = &mut ctx.accounts.escrow;
    let dispute = &mut ctx.accounts.dispute;
    
    // 確認是仲裁者
    require!(
        ctx.accounts.arbitrator.key() == config.arbitrator,
        ZuviError::NotArbitrator
    );
    
    // 確認爭議狀態
    require!(
        dispute.status == DISPUTE_STATUS_OPEN,
        ZuviError::DisputeAlreadyResolved
    );
    
    // 確認金額總和正確
    let total = landlord_amount + tenant_amount;
    require!(
        total == escrow.amount,
        ZuviError::AmountMismatch
    );
    
    // 執行轉帳
    let lease_key = lease.key();
    let escrow_seeds = &[
        ESCROW_SEED,
        lease_key.as_ref(),
        &[ctx.bumps.escrow],
    ];
    let signer_seeds = &[&escrow_seeds[..]];
    
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
                signer_seeds,
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
                signer_seeds,
            ),
            tenant_amount,
        )?;
    }
    
    // 更新狀態
    escrow.status = ESCROW_STATUS_RELEASED;
    escrow.release_to_landlord = landlord_amount;
    escrow.release_to_tenant = tenant_amount;
    escrow.has_dispute = false;
    dispute.status = DISPUTE_STATUS_RESOLVED;
    
    msg!("爭議已解決");
    msg!("房東收到: {} USDC", landlord_amount);
    msg!("承租人收到: {} USDC", tenant_amount);
    
    Ok(())
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    /// 系統配置
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    
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
        bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    /// 爭議帳戶
    #[account(
        mut,
        seeds = [DISPUTE_SEED, lease.key().as_ref()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,
    
    /// 仲裁者
    pub arbitrator: Signer<'info>,
    
    /// Escrow Token 帳戶
    #[account(
        mut,
        constraint = escrow_token.owner == escrow.key(),
        constraint = escrow_token.mint == config.usdc_mint
    )]
    pub escrow_token: InterfaceAccount<'info, TokenAccount>,
    
    /// 房東 Token 帳戶
    #[account(
        mut,
        constraint = landlord_token.owner == lease.landlord,
        constraint = landlord_token.mint == config.usdc_mint
    )]
    pub landlord_token: InterfaceAccount<'info, TokenAccount>,
    
    /// 承租人 Token 帳戶  
    #[account(
        mut,
        constraint = tenant_token.owner == lease.tenant,
        constraint = tenant_token.mint == config.usdc_mint
    )]
    pub tenant_token: InterfaceAccount<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}
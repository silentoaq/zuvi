use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use anchor_spl::token_interface::TokenAccount;
use crate::{constants::*, errors::*, state::*};

/// 確認押金結算
pub fn confirm_release(ctx: Context<ConfirmRelease>) -> Result<()> {
    let lease = &ctx.accounts.lease;
    let escrow = &mut ctx.accounts.escrow;
    let signer = &ctx.accounts.signer;
    
    // 確認是租約當事人
    require!(
        signer.key() == lease.landlord || signer.key() == lease.tenant,
        ZuviError::Unauthorized
    );
    
    // 確認狀態正確
    require!(
        escrow.status == ESCROW_STATUS_RELEASING,
        ZuviError::InvalidParameter
    );
    
    // 確認沒有爭議
    require!(
        !escrow.has_dispute,
        ZuviError::DisputeInProgress
    );
    
    // 確認是另一方確認
    if signer.key() == lease.landlord {
        require!(!escrow.landlord_signed, ZuviError::AlreadySigned);
        escrow.landlord_signed = true;
    } else {
        require!(!escrow.tenant_signed, ZuviError::AlreadySigned);
        escrow.tenant_signed = true;
    }
    
    // 如果雙方都已確認，執行轉帳
    if escrow.landlord_signed && escrow.tenant_signed {
        let lease_key = lease.key();
        let escrow_seeds = &[
            ESCROW_SEED,
            lease_key.as_ref(),
            &[ctx.bumps.escrow],
        ];
        let signer_seeds = &[&escrow_seeds[..]];
        
        // 轉帳給房東
        if escrow.release_to_landlord > 0 {
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
                escrow.release_to_landlord,
            )?;
        }
        
        // 轉帳給承租人
        if escrow.release_to_tenant > 0 {
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
                escrow.release_to_tenant,
            )?;
        }
        
        // 更新狀態
        escrow.status = ESCROW_STATUS_RELEASED;
        
        msg!("押金已釋放");
        msg!("房東收到: {} USDC", escrow.release_to_landlord);
        msg!("承租人收到: {} USDC", escrow.release_to_tenant);
    } else {
        msg!("等待另一方確認");
    }
    
    Ok(())
}

#[derive(Accounts)]
pub struct ConfirmRelease<'info> {
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
    
    /// 確認人（房東或承租人）
    pub signer: Signer<'info>,
    
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
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use anchor_spl::token_interface::TokenAccount;
use crate::{constants::*, errors::*, state::*};

pub fn resolve_dispute(
    ctx: Context<ResolveDispute>,
    landlord_amount: u64,
    tenant_amount: u64,
) -> Result<()> {
    let config = &ctx.accounts.config;
    let lease = &ctx.accounts.lease;
    let escrow = &mut ctx.accounts.escrow;
    let dispute = &mut ctx.accounts.dispute;
    
    require!(
        ctx.accounts.arbitrator.key() == config.arbitrator,
        ZuviError::NotArbitrator
    );
    
    require!(
        dispute.status == DISPUTE_STATUS_OPEN,
        ZuviError::DisputeAlreadyResolved
    );
    
    let total = landlord_amount + tenant_amount;
    require!(
        total == escrow.amount,
        ZuviError::AmountMismatch
    );
    
    let lease_key = lease.key();
    let escrow_seeds = &[
        ESCROW_SEED,
        lease_key.as_ref(),
        &[ctx.bumps.escrow],
    ];
    let signer_seeds = &[&escrow_seeds[..]];
    
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
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    
    #[account(
        seeds = [LEASE_SEED, lease.listing.as_ref(), lease.tenant.as_ref(), &lease.start_date.to_le_bytes()],
        bump
    )]
    pub lease: Account<'info, Lease>,
    
    #[account(
        mut,
        seeds = [ESCROW_SEED, lease.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    #[account(
        mut,
        seeds = [DISPUTE_SEED, lease.key().as_ref()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,
    
    pub arbitrator: Signer<'info>,
    
    #[account(
        mut,
        constraint = escrow_token.owner == escrow.key(),
        constraint = escrow_token.mint == config.usdc_mint
    )]
    pub escrow_token: InterfaceAccount<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = landlord_token.owner == lease.landlord,
        constraint = landlord_token.mint == config.usdc_mint
    )]
    pub landlord_token: InterfaceAccount<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = tenant_token.owner == lease.tenant,
        constraint = tenant_token.mint == config.usdc_mint
    )]
    pub tenant_token: InterfaceAccount<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}
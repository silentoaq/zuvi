use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use anchor_spl::token_interface::TokenAccount;
use crate::{constants::*, errors::*, events::ReleaseConfirmed, state::*};

pub fn confirm_release(ctx: Context<ConfirmRelease>) -> Result<()> {
    let lease = &ctx.accounts.lease;
    let listing = &mut ctx.accounts.listing;
    let escrow = &mut ctx.accounts.escrow;
    let signer = &ctx.accounts.signer;
    
    require!(
        signer.key() == lease.landlord || signer.key() == lease.tenant,
        ZuviError::Unauthorized
    );
    
    require!(
        escrow.status == ESCROW_STATUS_RELEASING,
        ZuviError::InvalidParameter
    );
    
    require!(
        !escrow.has_dispute,
        ZuviError::DisputeInProgress
    );
    
    if signer.key() == lease.landlord {
        require!(!escrow.landlord_signed, ZuviError::AlreadySigned);
        escrow.landlord_signed = true;
    } else {
        require!(!escrow.tenant_signed, ZuviError::AlreadySigned);
        escrow.tenant_signed = true;
    }
    
    if escrow.landlord_signed && escrow.tenant_signed {
        let lease_key = lease.key();
        let escrow_seeds = &[
            ESCROW_SEED,
            lease_key.as_ref(),
            &[ctx.bumps.escrow],
        ];
        let signer_seeds = &[&escrow_seeds[..]];
        
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
        
        escrow.status = ESCROW_STATUS_RELEASED;
        listing.status = LISTING_STATUS_AVAILABLE;
        listing.current_tenant = None;
        listing.has_active_lease = false;
        
        emit!(ReleaseConfirmed {
            escrow: escrow.key(),
            lease: lease.key(),
            listing: listing.key(),
            landlord: lease.landlord,
            tenant: lease.tenant,
            landlord_amount: escrow.release_to_landlord,
            tenant_amount: escrow.release_to_tenant,
        });
        
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
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Box<Account<'info, Config>>,
    
    #[account(
        mut,
        seeds = [LISTING_SEED, listing.property_attest.as_ref()],
        bump
    )]
    pub listing: Box<Account<'info, Listing>>,
    
    #[account(
        seeds = [LEASE_SEED, lease.listing.as_ref(), lease.tenant.as_ref(), &lease.start_date.to_le_bytes()],
        bump,
        constraint = lease.listing == listing.key()
    )]
    pub lease: Box<Account<'info, Lease>>,
    
    #[account(
        mut,
        seeds = [ESCROW_SEED, lease.key().as_ref()],
        bump
    )]
    pub escrow: Box<Account<'info, Escrow>>,
    
    pub signer: Signer<'info>,
    
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
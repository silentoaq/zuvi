use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use anchor_spl::token_interface::{Mint, TokenAccount};
use crate::{constants::*, errors::*, state::*};

pub fn sign_lease(ctx: Context<SignLease>) -> Result<()> {
    let config = &ctx.accounts.config;
    let listing = &mut ctx.accounts.listing;
    let lease = &mut ctx.accounts.lease;
    
    require!(
        lease.tenant == ctx.accounts.tenant.key(),
        ZuviError::Unauthorized
    );
    
    require!(
        !lease.tenant_signed,
        ZuviError::AlreadySigned
    );
    
    require!(
        lease.landlord_signed,
        ZuviError::NotSigned
    );
    
    let platform_fee = lease.rent
        .checked_mul(config.fee_rate as u64).unwrap()
        .checked_div(10000).unwrap();
    let landlord_rent = lease.rent - platform_fee;
    
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.tenant_token.to_account_info(),
                to: ctx.accounts.escrow_token.to_account_info(),
                authority: ctx.accounts.tenant.to_account_info(),
            },
        ),
        lease.deposit,
    )?;
    
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.tenant_token.to_account_info(),
                to: ctx.accounts.landlord_token.to_account_info(),
                authority: ctx.accounts.tenant.to_account_info(),
            },
        ),
        landlord_rent,
    )?;
    
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
    
    lease.tenant_signed = true;
    lease.paid_months = 1;
    lease.last_payment = Clock::get()?.unix_timestamp;
    
    let escrow = &mut ctx.accounts.escrow;
    escrow.lease = lease.key();
    escrow.amount = lease.deposit;
    escrow.status = ESCROW_STATUS_HOLDING;
    escrow.release_to_landlord = 0;
    escrow.release_to_tenant = 0;
    escrow.landlord_signed = false;
    escrow.tenant_signed = false;
    escrow.has_dispute = false;
    
    listing.status = LISTING_STATUS_RENTED;
    listing.current_tenant = Some(lease.tenant);
    
    msg!("租約已生效");
    msg!("押金 {} USDC 已託管", lease.deposit);
    msg!("首期租金已支付");
    
    Ok(())
}

#[derive(Accounts)]
pub struct SignLease<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Box<Account<'info, Config>>,
    
    #[account(mut, seeds = [LISTING_SEED, listing.property_attest.as_ref()], bump)]
    pub listing: Box<Account<'info, Listing>>,
    
    #[account(
        mut,
        seeds = [LEASE_SEED, lease.listing.as_ref(), lease.tenant.as_ref(), &lease.start_date.to_le_bytes()],
        bump,
        constraint = lease.listing == listing.key()
    )]
    pub lease: Box<Account<'info, Lease>>,
    
    #[account(
        init,
        payer = tenant,
        space = ESCROW_SIZE,
        seeds = [ESCROW_SEED, lease.key().as_ref()],
        bump
    )]
    pub escrow: Box<Account<'info, Escrow>>,
    
    #[account(mut)]
    pub tenant: Signer<'info>,
    
    #[account(
        mut,
        constraint = tenant_token.owner == tenant.key(),
        constraint = tenant_token.mint == usdc_mint.key()
    )]
    pub tenant_token: InterfaceAccount<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = landlord_token.owner == lease.landlord,
        constraint = landlord_token.mint == usdc_mint.key()
    )]
    pub landlord_token: InterfaceAccount<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = fee_receiver_token.owner == config.fee_receiver,
        constraint = fee_receiver_token.mint == usdc_mint.key()
    )]
    pub fee_receiver_token: InterfaceAccount<'info, TokenAccount>,
    
    #[account(
        init,
        payer = tenant,
        token::mint = usdc_mint,
        token::authority = escrow,
        seeds = [b"escrow_token", lease.key().as_ref()],
        bump
    )]
    pub escrow_token: InterfaceAccount<'info, TokenAccount>,
    
    #[account(constraint = usdc_mint.key() == config.usdc_mint)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
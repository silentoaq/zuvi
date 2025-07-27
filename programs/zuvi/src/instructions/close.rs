use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, CloseAccount};
use crate::errors::ErrorCode;
use crate::state::{
    Application, Config, Escrow, Lease, Listing,
    APPLICATION_STATUS_PENDING, ESCROW_STATUS_SETTLED, LISTING_STATUS_RENTED
};

// 關閉已處理的申請
#[derive(Accounts)]
pub struct CloseApplication<'info> {
    #[account(
        mut,
        seeds = [Application::SEED, application.listing.as_ref(), application.tenant_attest.as_ref()],
        bump,
        close = applicant,
        constraint = application.status != APPLICATION_STATUS_PENDING @ ErrorCode::ApplicationNotFound,
        constraint = application.applicant == applicant.key() @ ErrorCode::Unauthorized
    )]
    pub application: Account<'info, Application>,
    
    #[account(mut)]
    pub applicant: Signer<'info>,
}

// 關閉已結算的押金託管
#[derive(Accounts)]
pub struct CloseEscrow<'info> {
    #[account(
        seeds = [Config::SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    
    #[account(
        mut,
        seeds = [Escrow::SEED, escrow.lease.as_ref()],
        bump,
        close = authority,
        constraint = escrow.status == ESCROW_STATUS_SETTLED @ ErrorCode::EscrowAlreadySettled,
        constraint = !escrow.has_dispute @ ErrorCode::DisputeInProgress
    )]
    pub escrow: Account<'info, Escrow>,
    
    #[account(
        seeds = [Lease::SEED, lease.listing.as_ref(), lease.tenant_attest.as_ref()],
        bump,
        constraint = lease.key() == escrow.lease @ ErrorCode::LeaseNotFound
    )]
    pub lease: Account<'info, Lease>,
    
    #[account(
        mut,
        constraint = escrow_token.owner == escrow.key(),
        constraint = escrow_token.mint == config.usdc_mint @ ErrorCode::InvalidCredential,
        constraint = escrow_token.amount == 0 @ ErrorCode::InsufficientDeposit
    )]
    pub escrow_token: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = authority.key() == lease.landlord || authority.key() == lease.tenant @ ErrorCode::Unauthorized
    )]
    pub authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

// 申請自動過期（任何人都可以觸發，租金退給申請人）
#[derive(Accounts)]
pub struct ExpireApplication<'info> {
    #[account(
        mut,
        seeds = [Application::SEED, listing.key().as_ref(), application.tenant_attest.as_ref()],
        bump,
        close = applicant,
        constraint = application.status == APPLICATION_STATUS_PENDING @ ErrorCode::ApplicationExpired
    )]
    pub application: Account<'info, Application>,
    
    #[account(
        seeds = [Listing::SEED, listing.property_attest.as_ref()],
        bump,
        constraint = listing.status == LISTING_STATUS_RENTED @ ErrorCode::ListingAlreadyRented
    )]
    pub listing: Account<'info, Listing>,
    
    /// CHECK: 申請人帳戶（接收退還的租金）
    #[account(
        mut,
        constraint = applicant.key() == application.applicant @ ErrorCode::Unauthorized
    )]
    pub applicant: AccountInfo<'info>,
}

pub fn close_application(_ctx: Context<CloseApplication>) -> Result<()> {
    Ok(())
}

pub fn close_escrow(ctx: Context<CloseEscrow>) -> Result<()> {
    // 關閉 escrow token account
    let escrow = &ctx.accounts.escrow;
    let seeds = &[
        Escrow::SEED,
        escrow.lease.as_ref(),
        &[ctx.bumps.escrow],
    ];
    
    token::close_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.escrow_token.to_account_info(),
                destination: ctx.accounts.authority.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            },
            &[seeds],
        )
    )?;
    
    Ok(())
}

pub fn expire_application(_ctx: Context<ExpireApplication>) -> Result<()> {
    Ok(())
}
use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, state::*};

pub fn close_application(ctx: Context<CloseApplication>) -> Result<()> {
    let application = &ctx.accounts.application;
    let applicant = &ctx.accounts.applicant;
    
    require!(
        application.applicant == applicant.key(),
        ZuviError::Unauthorized
    );
    
    require!(
        application.status != APPLICATION_STATUS_APPROVED,
        ZuviError::AlreadySigned
    );
    
    msg!("申請已關閉");
    msg!("申請人: {}", applicant.key());
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(_applicant: Pubkey, _created_at: i64)]
pub struct CloseApplication<'info> {
    #[account(
        mut,
        close = applicant,
        seeds = [APPLICATION_SEED, application.listing.as_ref(), applicant.key().as_ref(), &_created_at.to_le_bytes()],
        bump,
        constraint = application.applicant == applicant.key()
    )]
    pub application: Account<'info, Application>,
    
    #[account(mut)]
    pub applicant: Signer<'info>,
}
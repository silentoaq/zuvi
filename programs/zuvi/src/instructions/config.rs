use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::events::ConfigUpdated;
use crate::state::{Config, MAX_FEE_RATE};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = Config::LEN,
        seeds = [Config::SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [Config::SEED],
        bump,
        constraint = config.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub config: Account<'info, Config>,
    
    pub authority: Signer<'info>,
}

pub fn initialize(
    ctx: Context<Initialize>,
    authority: Pubkey,
    api_signer: Pubkey,
    arbitrator: Pubkey,
    fee_receiver: Pubkey,
    fee_rate: u16,
    usdc_mint: Pubkey,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    
    require!(!config.initialized, ErrorCode::AlreadyInitialized);
    require!(fee_rate <= MAX_FEE_RATE, ErrorCode::InvalidFeeRate);
    
    config.authority = authority;
    config.api_signer = api_signer;
    config.arbitrator = arbitrator;
    config.fee_receiver = fee_receiver;
    config.fee_rate = fee_rate;
    config.usdc_mint = usdc_mint;
    config.initialized = true;
    
    Ok(())
}

pub fn update_config(
    ctx: Context<UpdateConfig>,
    api_signer: Option<Pubkey>,
    arbitrator: Option<Pubkey>,
    fee_receiver: Option<Pubkey>,
    fee_rate: Option<u16>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    
    if let Some(rate) = fee_rate {
        require!(rate <= MAX_FEE_RATE, ErrorCode::InvalidFeeRate);
        config.fee_rate = rate;
    }
    
    if let Some(signer) = api_signer {
        config.api_signer = signer;
    }
    
    if let Some(arb) = arbitrator {
        config.arbitrator = arb;
    }
    
    if let Some(receiver) = fee_receiver {
        config.fee_receiver = receiver;
    }
    
    emit!(ConfigUpdated {
        updater: ctx.accounts.authority.key(),
        api_signer,
        arbitrator,
        fee_receiver,
        fee_rate,
    });
    
    Ok(())
}
use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, state::*};

/// 初始化系統配置
pub fn initialize(
    ctx: Context<Initialize>,
    api_signer: Pubkey,
    arbitrator: Pubkey,
    fee_receiver: Pubkey,
    usdc_mint: Pubkey,
    fee_rate: u16,
) -> Result<()> {
    // 檢查費率是否合理
    require!(
        fee_rate <= MAX_FEE_RATE,
        ZuviError::InvalidFeeRate
    );

    let config = &mut ctx.accounts.config;
    
    // 設定系統配置
    config.api_signer = api_signer;
    config.arbitrator = arbitrator;
    config.fee_receiver = fee_receiver;
    config.usdc_mint = usdc_mint;
    config.fee_rate = fee_rate;
    config.initialized = true;

    msg!("系統初始化成功");
    msg!("API Signer: {}", api_signer);
    msg!("仲裁者: {}", arbitrator);
    msg!("費用接收者: {}", fee_receiver);
    msg!("USDC Mint: {}", usdc_mint);
    msg!("費率: {} basis points", fee_rate);

    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// 系統配置帳戶
    #[account(
        init,
        payer = authority,
        space = CONFIG_SIZE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    
    /// 初始化授權者（支付者）
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// 系統程式
    pub system_program: Program<'info, System>,
}
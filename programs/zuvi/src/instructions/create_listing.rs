use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, state::*};

/// 創建房源列表
pub fn create_listing(
    ctx: Context<CreateListing>,
    address: [u8; 64],
    building_area: u32,
    rent: u64,
    deposit: u64,
    metadata_uri: [u8; 64],
) -> Result<()> {
    let config = &ctx.accounts.config;
    
    // 確認系統已初始化
    require!(
        config.initialized,
        ZuviError::NotInitialized
    );
    
    // 驗證 API 簽名者
    require!(
        ctx.accounts.api_signer.key() == config.api_signer,
        ZuviError::ApiSignatureRequired
    );
    
    // 驗證押金金額（1-3個月租金）
    let min_deposit = rent.checked_mul(MIN_DEPOSIT_MONTHS as u64).unwrap();
    let max_deposit = rent.checked_mul(MAX_DEPOSIT_MONTHS as u64).unwrap();
    require!(
        deposit >= min_deposit && deposit <= max_deposit,
        ZuviError::InvalidDepositAmount
    );
    
    let listing = &mut ctx.accounts.listing;
    let clock = Clock::get()?;
    
    // 設定房源資料
    listing.owner = ctx.accounts.owner.key();
    listing.property_attest = ctx.accounts.property_attest.key();
    listing.address = address;
    listing.building_area = building_area;
    listing.rent = rent;
    listing.deposit = deposit;
    listing.metadata_uri = metadata_uri;
    listing.status = LISTING_STATUS_AVAILABLE;
    listing.current_tenant = None;
    listing.created_at = clock.unix_timestamp;
    
    msg!("房源創建成功");
    msg!("房東: {}", listing.owner);
    msg!("產權憑證: {}", listing.property_attest);
    msg!("月租金: {} USDC", rent);
    msg!("押金: {} USDC", deposit);
    
    Ok(())
}

#[derive(Accounts)]
pub struct CreateListing<'info> {
    /// 系統配置
    #[account(
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    
    /// 房源列表帳戶
    #[account(
        init,
        payer = owner,
        space = LISTING_SIZE,
        seeds = [LISTING_SEED, property_attest.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    
    /// 房東（支付者）
    #[account(mut)]
    pub owner: Signer<'info>,
    
    /// API 簽名者
    pub api_signer: Signer<'info>,
    
    /// 產權憑證帳戶
    /// CHECK: 由 API 驗證
    pub property_attest: AccountInfo<'info>,
    
    /// 系統程式
    pub system_program: Program<'info, System>,
}
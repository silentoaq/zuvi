use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("2Mipufx8cUUVUD5bqZjGK2yFWvjVM4jBaKVmw9zD5hzP");

#[program]
pub mod zuvi {
    use super::*;

    /// 初始化系統配置
    /// 設定 API 簽名者、仲裁者、費用接收者、USDC mint 和費率
    pub fn initialize(
        ctx: Context<Initialize>,
        api_signer: Pubkey,
        arbitrator: Pubkey,
        fee_receiver: Pubkey,
        usdc_mint: Pubkey,
        fee_rate: u16,
    ) -> Result<()> {
        instructions::initialize(ctx, api_signer, arbitrator, fee_receiver, usdc_mint, fee_rate)
    }

    /// 創建房源列表
    /// 需要 API 簽名，驗證產權憑證後創建
    pub fn create_listing(
        ctx: Context<CreateListing>,
        address: [u8; 64],
        building_area: u32,
        rent: u64,
        deposit: u64,
        metadata_uri: [u8; 46],
    ) -> Result<()> {
        instructions::create_listing(ctx, address, building_area, rent, deposit, metadata_uri)
    }

    /// 更新房源資訊
    /// 只能更新未出租的房源
    pub fn update_listing(
        ctx: Context<UpdateListing>,
        rent: Option<u64>,
        deposit: Option<u64>,
        metadata_uri: Option<[u8; 46]>,
    ) -> Result<()> {
        instructions::update_listing(ctx, rent, deposit, metadata_uri)
    }

    /// 切換房源狀態
    /// 在可用和下架之間切換
    pub fn toggle_listing(ctx: Context<ToggleListing>) -> Result<()> {
        instructions::toggle_listing(ctx)
    }

    /// 申請租賃
    /// 提交租賃申請和相關資料
    pub fn apply_lease(ctx: Context<ApplyLease>, message_uri: [u8; 46]) -> Result<()> {
        instructions::apply_lease(ctx, message_uri)
    }

    /// 核准申請
    /// 房東核准特定申請人
    pub fn approve_application(ctx: Context<ApproveApplication>, applicant: Pubkey) -> Result<()> {
        instructions::approve_application(ctx, applicant)
    }

    /// 創建租約
    /// 房東發起租約，設定條款
    pub fn create_lease(
        ctx: Context<CreateLease>,
        applicant: Pubkey,
        start_date: i64,
        end_date: i64,
        payment_day: u8,
        contract_uri: [u8; 46],
    ) -> Result<()> {
        instructions::create_lease(ctx, applicant, start_date, end_date, payment_day, contract_uri)
    }

    /// 簽署租約
    /// 承租人簽署並支付押金和首期租金
    pub fn sign_lease(ctx: Context<SignLease>) -> Result<()> {
        instructions::sign_lease(ctx)
    }

    /// 支付租金
    /// 每月定期支付租金
    pub fn pay_rent(ctx: Context<PayRent>) -> Result<()> {
        instructions::pay_rent(ctx)
    }

    /// 發起押金結算
    /// 任一方發起押金分配方案
    pub fn initiate_release(
        ctx: Context<InitiateRelease>,
        landlord_amount: u64,
        tenant_amount: u64,
    ) -> Result<()> {
        instructions::initiate_release(ctx, landlord_amount, tenant_amount)
    }

    /// 確認押金結算
    /// 另一方確認押金分配
    pub fn confirm_release(ctx: Context<ConfirmRelease>) -> Result<()> {
        instructions::confirm_release(ctx)
    }

    /// 發起爭議
    /// 對押金分配有異議時發起
    pub fn raise_dispute(ctx: Context<RaiseDispute>, reason: u8) -> Result<()> {
        instructions::raise_dispute(ctx, reason)
    }

    /// 解決爭議
    /// 仲裁者裁決押金分配
    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        landlord_amount: u64,
        tenant_amount: u64,
    ) -> Result<()> {
        instructions::resolve_dispute(ctx, landlord_amount, tenant_amount)
    }
}
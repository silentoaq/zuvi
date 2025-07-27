use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("2Mipufx8cUUVUD5bqZjGK2yFWvjVM4jBaKVmw9zD5hzP");

#[program]
pub mod zuvi {
    use super::*;

    // 系統初始化 - 只能執行一次
    pub fn initialize(
        ctx: Context<Initialize>,
        authority: Pubkey,
        api_signer: Pubkey,
        arbitrator: Pubkey,
        fee_receiver: Pubkey,
        fee_rate: u16,
        usdc_mint: Pubkey,
    ) -> Result<()> {
        instructions::initialize(ctx, authority, api_signer, arbitrator, fee_receiver, fee_rate, usdc_mint)
    }

    // 更新系統設定 - 只有 authority 可執行
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        api_signer: Option<Pubkey>,
        arbitrator: Option<Pubkey>,
        fee_receiver: Option<Pubkey>,
        fee_rate: Option<u16>,
    ) -> Result<()> {
        instructions::update_config(ctx, api_signer, arbitrator, fee_receiver, fee_rate)
    }

    // 刊登房源 - 需要 API 簽名驗證
    pub fn create_listing(
        ctx: Context<CreateListing>,
        address: String,
        building_area: u32,
        use_type: String,
        rent: u64,
        deposit: u64,
        grace_days: u8,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::create_listing(
            ctx,
            address,
            building_area,
            use_type,
            rent,
            deposit,
            grace_days,
            metadata_uri,
        )
    }

    // 更新房源資訊
    pub fn update_listing(
        ctx: Context<UpdateListing>,
        rent: u64,
        deposit: u64,
        grace_days: u8,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::update_listing(ctx, rent, deposit, grace_days, metadata_uri)
    }

    // 上架/下架房源切換
    pub fn toggle_listing(ctx: Context<ToggleListing>) -> Result<()> {
        instructions::toggle_listing(ctx)
    }

    // 申請租賃
    pub fn apply_lease(ctx: Context<ApplyLease>, message: String) -> Result<()> {
        instructions::apply_lease(ctx, message)
    }

    // 核准申請
    pub fn approve_application(ctx: Context<ApproveApplication>) -> Result<()> {
        instructions::approve_application(ctx)
    }

    // 拒絕申請
    pub fn reject_application(ctx: Context<RejectApplication>) -> Result<()> {
        instructions::reject_application(ctx)
    }

    // 簽署租約 - 需要 API 簽名驗證
    pub fn sign_lease(
        ctx: Context<SignLease>,
        start_date: i64,
        end_date: i64,
        payment_day: u8,
        total_payments: u32,
    ) -> Result<()> {
        instructions::sign_lease(ctx, start_date, end_date, payment_day, total_payments)
    }

    // 支付租金
    pub fn pay_rent(ctx: Context<PayRent>, payment_index: u32, next_due_date: i64) -> Result<()> {
        instructions::pay_rent(ctx, payment_index, next_due_date)
    }

    // 終止租約
    pub fn terminate_lease(ctx: Context<TerminateLease>, reason: u8) -> Result<()> {
        instructions::terminate_lease(ctx, reason)
    }

    // 房東發起結算請求
    pub fn request_settle(
        ctx: Context<RequestSettle>,
        total_deductions: u64,
        deduction_count: u8,
    ) -> Result<()> {
        instructions::request_settle(ctx, total_deductions, deduction_count)
    }

    // 承租人確認結算
    pub fn confirm_settle(ctx: Context<ConfirmSettle>) -> Result<()> {
        instructions::confirm_settle(ctx)
    }

    // 仲裁者強制結算
    pub fn force_settle(ctx: Context<ForceSettle>) -> Result<()> {
        instructions::force_settle(ctx)
    }

    // 創建爭議
    pub fn create_dispute(ctx: Context<CreateDispute>, reason: u8) -> Result<()> {
        instructions::create_dispute(ctx, reason)
    }

    // 解決爭議
    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        dispute_id: u32,
        resolution: String,
        landlord_amount: u64,
        tenant_amount: u64,
    ) -> Result<()> {
        instructions::resolve_dispute(ctx, dispute_id, resolution, landlord_amount, tenant_amount)
    }

    // 關閉已處理的申請
    pub fn close_application(ctx: Context<CloseApplication>) -> Result<()> {
        instructions::close_application(ctx)
    }

    // 關閉已結算的押金託管
    pub fn close_escrow(ctx: Context<CloseEscrow>) -> Result<()> {
        instructions::close_escrow(ctx)
    }

    // 申請自動過期
    pub fn expire_application(ctx: Context<ExpireApplication>) -> Result<()> {
        instructions::expire_application(ctx)
    }
}
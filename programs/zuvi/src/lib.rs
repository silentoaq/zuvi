use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("2h2Gw1oK7zNHed7GBXFShqvJGzBaVkPEMB7EDRUcVdct");

#[program]
pub mod zuvi {
    use super::*;

    /// 初始化平台
    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        listing_fee: u64,
        contract_fee: u64,
        payment_fee: u64,
    ) -> Result<()> {
        instructions::initialize_platform(ctx, listing_fee, contract_fee, payment_fee)
    }

    /// 發布房源
    pub fn list_property(
        ctx: Context<ListProperty>,
        property_id: String,
        owner_attestation: String,
        monthly_rent: u64,
        deposit_months: u8,
        property_details_hash: String,
    ) -> Result<()> {
        instructions::list_property(
            ctx,
            property_id,
            owner_attestation,
            monthly_rent,
            deposit_months,
            property_details_hash,
        )
    }

    /// 申請租房
    pub fn apply_for_rental(
        ctx: Context<ApplyForRental>,
        applicant_attestation: String,
        proposed_terms: String,
    ) -> Result<()> {
        instructions::apply_for_rental(ctx, applicant_attestation, proposed_terms)
    }

    /// 房東接受申請
    pub fn accept_application(ctx: Context<AcceptApplication>) -> Result<()> {
        instructions::accept_application(ctx)
    }

    /// 房東拒絕申請
    pub fn reject_application(ctx: Context<RejectApplication>) -> Result<()> {
        instructions::reject_application(ctx)
    }

    /// 創建租賃合約
    pub fn create_contract(
        ctx: Context<CreateContract>,
        start_date: i64,
        end_date: i64,
        payment_day: u8,
        contract_hash: String,
    ) -> Result<()> {
        instructions::create_contract(ctx, start_date, end_date, payment_day, contract_hash)
    }

    /// 租客簽署合約並支付押金+首月租金
    pub fn sign_contract_and_pay(ctx: Context<SignContractAndPay>) -> Result<()> {
        instructions::sign_contract_and_pay(ctx)
    }

    /// 支付月租
    pub fn pay_monthly_rent(ctx: Context<PayMonthlyRent>, payment_month: String) -> Result<()> {
        instructions::pay_monthly_rent(ctx, payment_month)
    }

    /// 正常退租
    pub fn terminate_contract(ctx: Context<TerminateContract>, reason: String) -> Result<()> {
        instructions::terminate_contract(ctx, reason)
    }

    /// 下架房源
    pub fn delist_property(ctx: Context<DelistProperty>) -> Result<()> {
        instructions::delist_property(ctx)
    }

    /// 提取平台費用
    pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
        instructions::withdraw_fees(ctx, amount)
    }

    /// 提出爭議
    pub fn report_dispute(
        ctx: Context<ReportDispute>,
        reason: String,
        evidence_hash: String,
    ) -> Result<()> {
        instructions::report_dispute(ctx, reason, evidence_hash)
    }

    /// 回應爭議
    pub fn respond_to_dispute(
        ctx: Context<RespondToDispute>,
        response_evidence_hash: String,
    ) -> Result<()> {
        instructions::respond_to_dispute(ctx, response_evidence_hash)
    }
}
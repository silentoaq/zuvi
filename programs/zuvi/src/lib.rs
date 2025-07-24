use anchor_lang::prelude::*;

mod state;
mod errors;
mod events;
mod instructions;

use instructions::*;

declare_id!("2h2Gw1oK7zNHed7GBXFShqvJGzBaVkPEMB7EDRUcVdct");

#[program]
pub mod zuvi {
    use super::*;

    // 平台管理
    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        listing_fee: u64,
        contract_fee: u64,
        payment_fee: u64,
    ) -> Result<()> {
        instructions::platform::initialize(ctx, listing_fee, contract_fee, payment_fee)
    }

    pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
        instructions::platform::withdraw_fees(ctx, amount)
    }

    // 房源管理
    pub fn list_property(
        ctx: Context<ListProperty>,
        property_id: String,
        owner_attestation: String,
        monthly_rent: u64,
        deposit_months: u8,
        property_details_hash: String,
    ) -> Result<()> {
        instructions::property::list(
            ctx,
            property_id,
            owner_attestation,
            monthly_rent,
            deposit_months,
            property_details_hash,
        )
    }

    pub fn delist_property(ctx: Context<DelistProperty>) -> Result<()> {
        instructions::property::delist(ctx)
    }

    // 申請管理
    pub fn apply_for_rental(
        ctx: Context<ApplyForRental>,
        applicant_attestation: String,
        proposed_terms: String,
    ) -> Result<()> {
        instructions::application::apply(ctx, applicant_attestation, proposed_terms)
    }

    pub fn accept_application(ctx: Context<AcceptApplication>) -> Result<()> {
        instructions::application::accept(ctx)
    }

    pub fn reject_application(ctx: Context<RejectApplication>) -> Result<()> {
        instructions::application::reject(ctx)
    }

    // 合約管理
    pub fn create_contract(
        ctx: Context<CreateContract>,
        start_date: i64,
        end_date: i64,
        payment_day: u8,
        contract_hash: String,
    ) -> Result<()> {
        instructions::contract::create(ctx, start_date, end_date, payment_day, contract_hash)
    }

    pub fn sign_contract_and_pay(ctx: Context<SignContractAndPay>) -> Result<()> {
        instructions::contract::sign_and_pay(ctx)
    }

    pub fn terminate_contract(ctx: Context<TerminateContract>, reason: String) -> Result<()> {
        instructions::contract::terminate(ctx, reason)
    }

    // 支付管理
    pub fn pay_monthly_rent(ctx: Context<PayMonthlyRent>, payment_month: String) -> Result<()> {
        instructions::payment::pay_rent(ctx, payment_month)
    }

    // 爭議管理
    pub fn report_dispute(
        ctx: Context<ReportDispute>,
        reason: String,
        evidence_hash: String,
    ) -> Result<()> {
        instructions::dispute::report(ctx, reason, evidence_hash)
    }

    pub fn respond_to_dispute(
        ctx: Context<RespondToDispute>,
        response_evidence_hash: String,
    ) -> Result<()> {
        instructions::dispute::respond(ctx, response_evidence_hash)
    }
}
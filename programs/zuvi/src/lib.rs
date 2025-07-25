use anchor_lang::prelude::*;

mod state;
mod errors;
mod events;
mod context;
mod processor;

use context::*;

declare_id!("6ptqmN5bGJnx5ahuJaUV3kNKz2JhNgguuzHx7yvEGdfL");

#[program]
pub mod zuvi {
    use super::*;

    // 平台管理
    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        list_fee: u64,
        c_fee: u64,
        pay_fee: u64,
    ) -> Result<()> {
        processor::platform::initialize(ctx, list_fee, c_fee, pay_fee)
    }

    pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
        processor::platform::withdraw_fees(ctx, amount)
    }

    // 房源管理
    pub fn list_property(
        ctx: Context<ListProperty>,
        attest_pda: Pubkey,
        m_rent: u64,
        dep_months: u8,
        details: String,
    ) -> Result<()> {
        processor::property::list(ctx, attest_pda, m_rent, dep_months, details)
    }

    pub fn delist_property(ctx: Context<DelistProperty>) -> Result<()> {
        processor::property::delist(ctx)
    }

    // 申請管理
    pub fn apply_rental(
        ctx: Context<ApplyRental>,
        attest_pda: Pubkey,
        offer_rent: u64,
        offer_deposit: u64,
        offer_hash: String,
    ) -> Result<()> {
        processor::application::apply(ctx, attest_pda, offer_rent, offer_deposit, offer_hash)
    }

    pub fn counter_offer(
        ctx: Context<CounterOffer>,
        new_rent: u64,
        new_deposit: u64,
        new_hash: String,
    ) -> Result<()> {
        processor::application::counter(ctx, new_rent, new_deposit, new_hash)
    }

    pub fn accept_application(ctx: Context<AcceptApplication>) -> Result<()> {
        processor::application::accept(ctx)
    }

    pub fn reject_application(ctx: Context<RejectApplication>) -> Result<()> {
        processor::application::reject(ctx)
    }

    // 合約管理
    pub fn create_contract(
        ctx: Context<CreateContract>,
        start: i64,
        end: i64,
        pay_day: u8,
        c_hash: String,
    ) -> Result<()> {
        processor::contract::create(ctx, start, end, pay_day, c_hash)
    }

    pub fn sign_contract(ctx: Context<SignContract>) -> Result<()> {
        processor::contract::sign_contract(ctx)
    }

    pub fn terminate_contract(ctx: Context<TerminateContract>, reason: String) -> Result<()> {
        processor::contract::terminate(ctx, reason)
    }

    // 支付管理
    pub fn pay_rent(ctx: Context<PayRent>, pay_month: String) -> Result<()> {
        processor::payment::pay_rent(ctx, pay_month)
    }

    // 爭議管理
    pub fn report_dispute(
        ctx: Context<ReportDispute>,
        reason: String,
        e_hash: String,
    ) -> Result<()> {
        processor::dispute::report(ctx, reason, e_hash)
    }

    pub fn respond_dispute(
        ctx: Context<RespondDispute>,
        r_hash: String,
    ) -> Result<()> {
        processor::dispute::respond(ctx, r_hash)
    }
}
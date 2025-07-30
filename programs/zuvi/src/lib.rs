use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod time_utils;

use instructions::*;

declare_id!("5YUDDtqCHn11CgvmqNe3F2BgXzq68WeQJasv8hQFrux1");

#[program]
pub mod zuvi {
    use super::*;

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

    pub fn create_listing(
        ctx: Context<CreateListing>,
        address: [u8; 64],
        building_area: u32,
        rent: u64,
        deposit: u64,
        metadata_uri: [u8; 64],
    ) -> Result<()> {
        instructions::create_listing(ctx, address, building_area, rent, deposit, metadata_uri)
    }

    pub fn update_listing(
        ctx: Context<UpdateListing>,
        rent: Option<u64>,
        deposit: Option<u64>,
        metadata_uri: Option<[u8; 64]>,
    ) -> Result<()> {
        instructions::update_listing(ctx, rent, deposit, metadata_uri)
    }

    pub fn toggle_listing(ctx: Context<ToggleListing>) -> Result<()> {
        instructions::toggle_listing(ctx)
    }

    pub fn apply_lease(ctx: Context<ApplyLease>, message_uri: [u8; 64], created_at: i64) -> Result<()> {
        instructions::apply_lease(ctx, message_uri, created_at)
    }

    pub fn close_application(ctx: Context<CloseApplication>, _applicant: Pubkey, _created_at: i64) -> Result<()> {
        instructions::close_application(ctx)
    }

    pub fn approve_application(ctx: Context<ApproveApplication>, applicant: Pubkey, _created_at: i64) -> Result<()> {
        instructions::approve_application(ctx, applicant, _created_at)
    }

    pub fn reject_application(ctx: Context<RejectApplication>, applicant: Pubkey, _created_at: i64) -> Result<()> {
        instructions::reject_application(ctx, applicant, _created_at)
    }

    pub fn create_lease(
        ctx: Context<CreateLease>,
        applicant: Pubkey,
        _application_created_at: i64,
        start_date: i64,
        end_date: i64,
        payment_day: u8,
        contract_uri: [u8; 64],
    ) -> Result<()> {
        instructions::create_lease(ctx, applicant, _application_created_at, start_date, end_date, payment_day, contract_uri)
    }

    pub fn sign_lease(ctx: Context<SignLease>) -> Result<()> {
        instructions::sign_lease(ctx)
    }

    pub fn pay_rent(ctx: Context<PayRent>) -> Result<()> {
        instructions::pay_rent(ctx)
    }

    pub fn initiate_release(
        ctx: Context<InitiateRelease>,
        landlord_amount: u64,
        tenant_amount: u64,
    ) -> Result<()> {
        instructions::initiate_release(ctx, landlord_amount, tenant_amount)
    }

    pub fn confirm_release(ctx: Context<ConfirmRelease>) -> Result<()> {
        instructions::confirm_release(ctx)
    }

    pub fn raise_dispute(ctx: Context<RaiseDispute>, reason: u8) -> Result<()> {
        instructions::raise_dispute(ctx, reason)
    }

    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        landlord_amount: u64,
        tenant_amount: u64,
    ) -> Result<()> {
        instructions::resolve_dispute(ctx, landlord_amount, tenant_amount)
    }
}
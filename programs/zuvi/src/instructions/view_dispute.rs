use anchor_lang::prelude::*;
use crate::state::DisputeRecord;

#[derive(Accounts)]
pub struct ViewDispute<'info> {
    pub dispute_record: Account<'info, DisputeRecord>,
}

pub fn get_dispute_pda(contract: Pubkey, initiator: Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"dispute", contract.as_ref(), initiator.as_ref()],
        &crate::ID
    )
}
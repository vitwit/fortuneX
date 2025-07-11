use crate::instructions::Initialize;
use anchor_lang::prelude::*;

pub fn initialize(
    ctx: Context<Initialize>,
    platform_wallet: Pubkey,
    usdc_mint: Pubkey,
    platform_fee_bps: u16,
) -> Result<()> {
    Ok(())
}

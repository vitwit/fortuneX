use crate::instructions::Initialize;
use anchor_lang::prelude::*;

pub fn initialize(
    ctx: Context<Initialize>,
    platform_wallet: Pubkey,
    usdc_mint: Pubkey,
    platform_fee_bps: u16,
) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;

    // Validate platform fee is reasonable (max 10% = 1000 bps)
    require!(
        platform_fee_bps <= 1000,
        crate::FortuneXError::InvalidPlatformFee
    );

    // Initialize global state
    global_state.authority = ctx.accounts.authority.key();
    global_state.platform_wallet = platform_wallet;
    global_state.usdc_mint = usdc_mint;
    global_state.platform_fee_bps = platform_fee_bps;
    global_state.pools_count = 0;
    global_state.creators_whitelist = vec![ctx.accounts.authority.key()];
    global_state.bump = ctx.bumps.global_state;

    msg!("FortuneX lottery program initialized successfully!");
    msg!("Authority: {}", global_state.authority);
    msg!("Platform wallet: {}", global_state.platform_wallet);
    msg!("USDC mint: {}", global_state.usdc_mint);
    msg!("Platform fee: {} bps", global_state.platform_fee_bps);

    Ok(())
}

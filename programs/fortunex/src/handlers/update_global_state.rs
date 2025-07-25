use crate::instructions::UpdateGlobalState;
use crate::GlobalState;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct UpdateGlobalStateArgs {
    pub new_platform_wallet: Option<Pubkey>,
    pub new_usdc_mint: Option<Pubkey>,
    pub new_platform_fee_bps: Option<u16>,
    pub new_bonus_pool_fee_bps: Option<u16>,
}

pub fn update_global_state(
    ctx: Context<UpdateGlobalState>,
    args: UpdateGlobalStateArgs,
) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;

    if let Some(new_wallet) = args.new_platform_wallet {
        global_state.platform_wallet = new_wallet;
    }

    if let Some(new_usdc_mint) = args.new_usdc_mint {
        global_state.usdc_mint = new_usdc_mint;
    }

    if let Some(new_platform_fee_bps) = args.new_platform_fee_bps {
        // Validate platform fee is reasonable
        GlobalState::validate_platform_fee_bps(new_platform_fee_bps)?;

        global_state.platform_fee_bps = new_platform_fee_bps;
    }

    if let Some(new_bonus_pool_fee_bps) = args.new_bonus_pool_fee_bps {
        // Validate bonus pool fee is reasonable (max 10% = 1000 bps)
        GlobalState::validate_platform_fee_bps(new_bonus_pool_fee_bps)?;

        global_state.bonus_pool_fee_bps = new_bonus_pool_fee_bps;
    }

    // Log Updated Global State
    msg!("--- Global State Updated ---");
    msg!("Platform wallet: {}", global_state.platform_wallet);
    msg!("USDC mint: {}", global_state.usdc_mint);
    msg!("Platform fee: {} bps", global_state.platform_fee_bps);
    msg!("Bonus Pool fee: {} bps", global_state.platform_fee_bps);

    Ok(())
}

use anchor_lang::prelude::*;
use crate::{GlobalState, GLOBAL_STATE_SEED};
use anchor_spl::token::Mint;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + GlobalState::INIT_SPACE,
        seeds = [GLOBAL_STATE_SEED],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Platform wallet for receiving fees
    pub platform_wallet: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
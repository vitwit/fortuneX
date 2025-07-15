use crate::{FortuneXError, GlobalState, GLOBAL_STATE_SEED};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateWhitelist<'info> {
    #[account(
        mut,
        seeds = [GLOBAL_STATE_SEED],
        bump = global_state.bump,
        has_one = authority @ FortuneXError::Unauthorized
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: The creator address to add/remove from whitelist
    pub creator: UncheckedAccount<'info>,
}

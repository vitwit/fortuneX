use anchor_lang::prelude::*;
use crate::{GlobalState, GLOBAL_STATE_SEED};

#[derive(Accounts)]
pub struct UpdateGlobalState<'info> {
    #[account(
        mut,
        seeds = [GLOBAL_STATE_SEED],
        bump = global_state.bump,
        has_one = authority
    )]
    pub global_state: Account<'info, GlobalState>,
    
    #[account()]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}


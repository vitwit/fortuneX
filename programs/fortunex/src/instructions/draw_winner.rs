use crate::{
    DrawHistory, GlobalState, LotteryPool, BONUS_AUTHORITY_SEED, DRAW_HISTORY_SEED, GLOBAL_STATE_SEED, LOTTERY_POOL_SEED, VAULT_AUTHORITY_SEED
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
#[instruction(pool_id: u64)]
pub struct DrawWinner<'info> {
    #[account(
        seeds = [GLOBAL_STATE_SEED],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(
        mut,
        seeds = [LOTTERY_POOL_SEED, &pool_id.to_le_bytes()],
        bump = lottery_pool.bump
    )]
    pub lottery_pool: Account<'info, LotteryPool>,

    #[account(
        init_if_needed,
        payer = crank,
        space = 8 + DrawHistory::INIT_SPACE,
        seeds = [DRAW_HISTORY_SEED, &pool_id.to_le_bytes()],
        bump
    )]
    pub draw_history: Account<'info, DrawHistory>,

    #[account(
        mut,
        token::mint = global_state.usdc_mint,
        seeds = [VAULT_AUTHORITY_SEED, &pool_id.to_le_bytes()],
        bump
    )]
    pub pool_token_account: Account<'info, TokenAccount>,

    /// CHECK: This is a PDA used as authority for the pool's token account
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, &pool_id.to_le_bytes()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        token::mint = global_state.usdc_mint,
        token::authority = global_state.platform_wallet
    )]
    pub platform_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = global_state.usdc_mint,
        seeds = [BONUS_AUTHORITY_SEED],
        bump
    )]
    pub bonus_pool_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = global_state.usdc_mint,
        token::authority = lottery_pool.creator
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub crank: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    // remaining_accounts will contain all participant token accounts
    // in the same order as lottery_pool.participants
}

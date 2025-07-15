use crate::{
    GlobalState, LotteryPool, GLOBAL_STATE_SEED, LOTTERY_POOL_SEED, VAULT_AUTHORITY_SEED,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        mut,
        seeds = [GLOBAL_STATE_SEED],
        bump = global_state.bump,
        has_one = authority
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(
        init,
        payer = authority,
        space = 8 + LotteryPool::INIT_SPACE,
        seeds = [LOTTERY_POOL_SEED, &global_state.pools_count.to_le_bytes()],
        bump
    )]
    pub lottery_pool: Account<'info, LotteryPool>,

    #[account(
        init,
        payer = authority,
        token::mint = usdc_mint,
        token::authority = vault_authority,
        seeds = [VAULT_AUTHORITY_SEED, &global_state.pools_count.to_le_bytes()],
        bump
    )]
    pub pool_token_account: Account<'info, TokenAccount>, // this account will hold the tokens of the pool

    /// CHECK: This is a PDA used as authority for the pool's token account
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, &global_state.pools_count.to_le_bytes()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>, // this account will be the singer for transferring tokens from the pool to user

    #[account(address = global_state.usdc_mint)]
    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
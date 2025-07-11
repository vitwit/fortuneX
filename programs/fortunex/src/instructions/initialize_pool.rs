use crate::{
    GlobalState, LotteryPool, PoolVault, GLOBAL_STATE_SEED, LOTTERY_POOL_SEED, POOL_VAULT_SEED,
    VAULT_AUTHORITY_SEED,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        seeds = [GLOBAL_STATE_SEED],
        bump = global_state.bump,
        has_one = authority
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(
        init,
        payer = authority,
        space = 8 + LotteryPool::INIT_SPACE,
        seeds = [LOTTERY_POOL_SEED, &global_state.key().to_bytes()],
        bump
    )]
    pub lottery_pool: Account<'info, LotteryPool>,

    #[account(
        init,
        payer = authority,
        space = 8 + PoolVault::INIT_SPACE,
        seeds = [POOL_VAULT_SEED, lottery_pool.key().as_ref()],
        bump
    )]
    pub pool_vault: Account<'info, PoolVault>,

    #[account(
        init,
        payer = authority,
        token::mint = usdc_mint,
        token::authority = vault_authority,
        seeds = [VAULT_AUTHORITY_SEED, lottery_pool.key().as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// CHECK: This is a PDA used as authority for the vault
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, lottery_pool.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(address = global_state.usdc_mint)]
    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

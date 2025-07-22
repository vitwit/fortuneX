use crate::{
    GlobalState, LotteryPool, UserTicket, GLOBAL_STATE_SEED, LOTTERY_POOL_SEED, USER_TICKET_SEED,
    VAULT_AUTHORITY_SEED,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
#[instruction(pool_id: u64, ticket_number: u64)]
pub struct CancelTicket<'info> {
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
        mut,
        close = user, // return lamports to user
        seeds = [
            USER_TICKET_SEED,
            user.key().as_ref(),
            &pool_id.to_le_bytes(),
        ],
        bump
    )]
    pub user_ticket: Account<'info, UserTicket>,

    #[account(
        mut,
        token::mint = global_state.usdc_mint,
        token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = global_state.usdc_mint,
        seeds = [VAULT_AUTHORITY_SEED, &pool_id.to_le_bytes()],
        bump
    )]
    pub pool_token_account: Account<'info, TokenAccount>, // this account will hold the tokens of the pool

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

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

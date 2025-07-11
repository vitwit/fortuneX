use crate::{
    GlobalState, LotteryPool, UserTicket, GLOBAL_STATE_SEED, LOTTERY_POOL_SEED, USER_TICKET_SEED,
    VAULT_AUTHORITY_SEED,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
pub struct BuyTicket<'info> {
    #[account(
        seeds = [GLOBAL_STATE_SEED],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(
        mut,
        seeds = [LOTTERY_POOL_SEED, &global_state.key().to_bytes()],
        bump = lottery_pool.bump
    )]
    pub lottery_pool: Account<'info, LotteryPool>,

    #[account(
        init,
        payer = user,
        space = 8 + UserTicket::INIT_SPACE,
        seeds = [USER_TICKET_SEED, user.key().as_ref(), lottery_pool.key().as_ref(), &lottery_pool.round_number.to_le_bytes()],
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
        seeds = [VAULT_AUTHORITY_SEED, lottery_pool.key().as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

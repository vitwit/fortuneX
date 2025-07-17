use anchor_lang::prelude::*;
use crate::{GlobalState, BONUS_AUTHORITY_SEED, GLOBAL_STATE_SEED};
use anchor_spl::token::{Mint, Token, TokenAccount};

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

    #[account(
        init,
        payer = authority,
        token::mint = usdc_mint,
        token::authority = bonus_authority,
        seeds = [BONUS_AUTHORITY_SEED],
        bump
    )]
    pub bonus_pool_token_account: Account<'info, TokenAccount>, // this account will hold the tokens of the pool

    /// CHECK: This is a PDA used as authority for the pool's token account
    #[account(
        seeds = [BONUS_AUTHORITY_SEED],
        bump
    )]
    pub bonus_authority: UncheckedAccount<'info>, // this account will be the singer for transferring tokens from the bonus pool to user

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Platform wallet for receiving fees
    pub platform_wallet: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
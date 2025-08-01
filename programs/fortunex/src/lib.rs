use anchor_lang::prelude::*;

pub mod constants;
pub mod enums;
pub mod errors;
pub mod handlers;
pub mod instructions;
pub mod state;

pub use constants::*;
pub use enums::*;
pub use errors::*;
pub use instructions::*;
pub use state::*;

declare_id!("HD5X9GyjdqEMLyjP5QsLaKAweor6KQrcqCejf3NXwxpu");

#[program]
pub mod fortunex {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        platform_wallet: Pubkey,
        usdc_mint: Pubkey,
        platform_fee_bps: u16,
        bonus_pool_fee_bps: u16,
    ) -> Result<()> {
        handlers::initialize(
            ctx,
            platform_wallet,
            usdc_mint,
            platform_fee_bps,
            bonus_pool_fee_bps,
        )
    }

    // Initialize a new lottery pool
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        ticket_price: u64,
        min_tickets: u64,
        max_tickets: u64,
        draw_interval: i64,
    ) -> Result<()> {
        handlers::initialize_pool(ctx, ticket_price, min_tickets, max_tickets, draw_interval)
    }

    // Update creators whitelist
    pub fn update_whitelist(ctx: Context<UpdateWhitelist>, is_add: bool) -> Result<()> {
        handlers::update_whitelist(ctx, is_add)
    }

    // Update global state
    pub fn update_global_state(ctx: Context<UpdateGlobalState>, args: handlers::UpdateGlobalStateArgs) -> Result<()> {
        handlers::update_global_state(ctx, args)
    }

    // Buy a ticket for the lottery
    pub fn buy_ticket(ctx: Context<BuyTicket>, pool_id: u64, quantity: u64) -> Result<()> {
        handlers::buy_ticket(ctx, pool_id, quantity)
    }

    // Cancel a ticket from the lottery
    pub fn cancel_ticket(ctx: Context<CancelTicket>, pool_id: u64, ticket_number: u64) -> Result<()> {
        handlers::cancel_ticket(ctx, pool_id, ticket_number)
    }

    // Draw the winner
    pub fn draw_winner<'info>(
        ctx: Context<'_, '_, '_, 'info, DrawWinner<'info>>,
        pool_id: u64,
    ) -> Result<()> {
        handlers::draw_winner(ctx, pool_id)
    }
}

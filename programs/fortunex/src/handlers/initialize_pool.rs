use crate::enums::PoolStatus;
use crate::instructions::InitializePool;
use crate::LotteryPool;
use anchor_lang::prelude::*;

pub fn initialize_pool(
    ctx: Context<InitializePool>,
    ticket_price: u64,
    min_tickets: u64,
    max_tickets: u64,
    draw_interval: i64,
) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;
    let lottery_pool = &mut ctx.accounts.lottery_pool;
    let clock = Clock::get()?;

    // Validate given ticket price
    require!(ticket_price > 0, crate::FortuneXError::InvalidTicketPrice);

    // Validate given max tickets value
    require!(max_tickets > 0, crate::FortuneXError::InvalidMaxTickets);

    // Validate min_tickets cannot be greater than max_tickets
    require!(max_tickets >= min_tickets, crate::FortuneXError::InvalidMinMaxTickets);

    // // Validate draw interval (minimum 1 hour, maximum 7 days)
    // require!(
    //     draw_interval >= 3600 && draw_interval <= 604800,
    //     crate::FortuneXError::InvalidDrawInterval
    // );

    // Check if creator is whitelisted (only whitelisted creators can create pools)
    require!(
        global_state.is_creator_whitelisted(&ctx.accounts.authority.key()),
        crate::FortuneXError::CreatorNotWhitelisted
    );

    // Initialize lottery pool
    lottery_pool.pool_id = global_state.pools_count;
    lottery_pool.status = PoolStatus::Active;
    lottery_pool.prize_pool = 0;
    lottery_pool.ticket_price = ticket_price;
    lottery_pool.min_tickets = min_tickets;
    lottery_pool.max_tickets = max_tickets;
    lottery_pool.tickets_sold = Vec::new();
    lottery_pool.draw_interval = draw_interval;
    lottery_pool.draw_time = clock.unix_timestamp + draw_interval;
    lottery_pool.created_at = clock.unix_timestamp;
    lottery_pool.creator = ctx.accounts.authority.key();
    lottery_pool.commission_bps = LotteryPool::DEFAULT_COMMISSION_BPS;
    lottery_pool.bump = ctx.bumps.lottery_pool;
    lottery_pool.cancelled_tickets = Vec::new();

    // Increment global pools count
    global_state.pools_count = global_state
        .pools_count
        .checked_add(1)
        .ok_or(crate::FortuneXError::Overflow)?;

    msg!("New lottery pool created successfully!");
    msg!("Pool ID: {}", lottery_pool.pool_id);
    msg!("Creator: {}", ctx.accounts.authority.key());
    msg!("Draw interval: {} seconds", draw_interval);
    msg!("Next draw time: {}", lottery_pool.draw_time);
    msg!(
        "Pool token account: {}",
        ctx.accounts.pool_token_account.key()
    );
    msg!("Vault authority: {}", ctx.accounts.vault_authority.key());

    Ok(())
}

use crate::enums::PoolStatus;
use crate::instructions::BuyTicket;
use crate::FortuneXError;
use crate::LotteryPool;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};

pub fn buy_ticket(ctx: Context<BuyTicket>, pool_id: u64) -> Result<()> {
    let lottery_pool = &mut ctx.accounts.lottery_pool;
    let user_ticket = &mut ctx.accounts.user_ticket;
    let user = &ctx.accounts.user;
    let global_state = &ctx.accounts.global_state;
    let clock = Clock::get()?;

    // Validate pool is active and accepting tickets
    require!(
        lottery_pool.status == PoolStatus::Active,
        FortuneXError::PoolNotActive
    );

    // Check if pool has reached maximum participants
    require!(
        lottery_pool.participants.len() < LotteryPool::MAX_PARTICIPANTS,
        FortuneXError::PoolFull
    );

    // Validate ticket price matches expected amount
    require!(
        ctx.accounts.user_token_account.amount >= LotteryPool::TICKET_PRICE,
        FortuneXError::InsufficientFunds
    );

    // Transfer USDC from user to pool vault
    let transfer_instruction = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.pool_token_account.to_account_info(),
        authority: user.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        transfer_instruction,
    );

    token::transfer(cpi_ctx, LotteryPool::TICKET_PRICE)?;

    // Update lottery pool state
    lottery_pool.participants.push(user.key());
    lottery_pool.tickets_sold += 1;
    lottery_pool.prize_pool += LotteryPool::TICKET_PRICE;

    // Initialize user ticket
    user_ticket.user = user.key();
    user_ticket.pool = lottery_pool.key();
    user_ticket.pool_id = pool_id;
    user_ticket.ticket_number = lottery_pool.tickets_sold;
    user_ticket.amount_paid = LotteryPool::TICKET_PRICE;
    user_ticket.timestamp = clock.unix_timestamp;
    user_ticket.bump = ctx.bumps.user_ticket;

    // Check if pool is now full and ready for draw
    if lottery_pool.participants.len() == LotteryPool::MAX_PARTICIPANTS {
        lottery_pool.status = PoolStatus::ReadyForDraw;

        // Set draw time (could be immediate or after a delay)
        lottery_pool.draw_time = clock.unix_timestamp + lottery_pool.draw_interval;
    }

    msg!(
        "User {} bought ticket #{} for pool {} at price {}",
        user.key(),
        user_ticket.ticket_number,
        pool_id,
        LotteryPool::TICKET_PRICE
    );

    Ok(())
}

use crate::enums::PoolStatus;
use crate::instructions::BuyTicket;
use crate::FortuneXError;
use crate::TicketDetails;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};

pub fn buy_ticket(ctx: Context<BuyTicket>, pool_id: u64, quantity: u64) -> Result<()> {
    let lottery_pool = &mut ctx.accounts.lottery_pool;
    let user_ticket = &mut ctx.accounts.user_ticket;
    let user = &ctx.accounts.user;
    let clock = Clock::get()?;

    // Validate given quantity
    require!(quantity > 0, FortuneXError::InvalidTicketQuantity);

    // Validate pool is active and accepting tickets
    require!(
        lottery_pool.status == PoolStatus::Active,
        FortuneXError::PoolNotActive
    );

    // Check if pool has reached maximum tickets
    require!(
        lottery_pool.tickets_sold.len() as u64 + quantity <= lottery_pool.max_tickets,
        FortuneXError::PoolFull
    );

    let tickets_price = lottery_pool.ticket_price * quantity;

    // Validate ticket price matches expected amount
    require!(
        ctx.accounts.user_token_account.amount >= tickets_price,
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

    token::transfer(cpi_ctx, tickets_price)?;

    // update user ticket details
    for _i in 0..quantity {
        let new_ticket = TicketDetails {
            ticket_number: lottery_pool.tickets_sold.len() as u64,
            amount_paid: lottery_pool.ticket_price,
            timestamp: clock.unix_timestamp,
        };
        msg!(
            "User {} bought ticket #{} for pool {} at price {}",
            user.key(),
            new_ticket.ticket_number,
            pool_id,
            lottery_pool.ticket_price
        );

        user_ticket.tickets.push(new_ticket);

        // Update lottery pool state
        lottery_pool.tickets_sold.push(user.key());
        lottery_pool.prize_pool += lottery_pool.ticket_price;
    }

    user_ticket.user = user.key();
    user_ticket.pool = lottery_pool.key();
    user_ticket.pool_id = pool_id;
    user_ticket.bump = ctx.bumps.user_ticket;

    // Check if pool is now full and ready for draw
    if lottery_pool.tickets_sold.len() as u64 == lottery_pool.max_tickets {
        lottery_pool.status = PoolStatus::PoolFull;
    }

    Ok(())
}

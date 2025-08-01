use crate::enums::PoolStatus;
use crate::instructions::CancelTicket;
use crate::FortuneXError;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};

pub fn cancel_ticket(ctx: Context<CancelTicket>, pool_id: u64, ticket_number: u64) -> Result<()> {
    let lottery_pool = &mut ctx.accounts.lottery_pool;
    let user_ticket = &mut ctx.accounts.user_ticket;
    let global_state = &ctx.accounts.global_state;
    let user = &ctx.accounts.user;

    // Validate pool is active
    require!(
        lottery_pool.status != PoolStatus::Completed,
        FortuneXError::PoolNotActive
    );

    // check whether user owns given ticket
    let maybe_ticket_details = {
        let tickets = &user_ticket.tickets;
        tickets
            .iter()
            .find(|t| t.ticket_number == ticket_number)
            .cloned()
    };

    let cancelled_ticket = match maybe_ticket_details {
        Some(t) => t,
        None => {
            msg!("User does not own ticket {}", ticket_number);
            return err!(FortuneXError::TicketNotFound);
        }
    };

    // cancel ticket
    user_ticket
        .tickets
        .retain(|t| t.ticket_number != ticket_number);

    let amount_paid = cancelled_ticket.amount_paid;

    // Calculate cancellation fee using platform fee basis points (bps)
    let cancellation_fee = (amount_paid * global_state.platform_fee_bps as u64) / 10000;
    let refund_amount = amount_paid - cancellation_fee;

    // Create vault authority signer seeds
    let vault_authority_seeds = &[
        b"vault_authority".as_ref(),
        &pool_id.to_le_bytes(),
        &[ctx.bumps.vault_authority],
    ];
    let vault_signer = &[&vault_authority_seeds[..]];

    // Refund amount from pool vault to user
    let refund_instruction = Transfer {
        from: ctx.accounts.pool_token_account.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };

    let refund_cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        refund_instruction,
        vault_signer,
    );

    token::transfer(refund_cpi_ctx, refund_amount)?;

    // Transfer cancellation fee to platform token account
    let transfer_to_platform = Transfer {
        from: ctx.accounts.pool_token_account.to_account_info(),
        to: ctx.accounts.platform_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };

    let platform_cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_to_platform,
        vault_signer,
    );

    token::transfer(platform_cpi_ctx, cancellation_fee)?;

    // Update lottery pool state
    let user_key = user.key();

    // find occurence of user key in tickets sold
    let index_to_remove = {
        let tickets = &lottery_pool.tickets_sold;
        tickets.iter().position(|k| k == &user_key)
    };

    // remove user key from tickets_sold
    if let Some(index) = index_to_remove {
        lottery_pool.tickets_sold.remove(index);
    }

    lottery_pool.prize_pool -= cancelled_ticket.amount_paid;
    lottery_pool.cancelled_tickets.push(ticket_number);

    // Check if pool status is full and update status
    if lottery_pool.status == PoolStatus::PoolFull {
        lottery_pool.status = PoolStatus::Active;
    }

    msg!(
        "Cancelled ticket #{} from user {} in pool {}",
        ticket_number,
        user.key(),
        pool_id,
    );

    // Optionally close the account if it's empty
    if user_ticket.tickets.is_empty() {
        msg!(
            "No tickets left. Closing user_ticket account {}",
            user.key()
        );
        return Ok(());
    }

    Ok(())
}

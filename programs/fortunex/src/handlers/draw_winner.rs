use crate::enums::PoolStatus;
use crate::instructions::DrawWinner;
use crate::FortuneXError;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};

pub fn draw_winner<'info>(
    ctx: Context<'_, '_, '_, 'info, DrawWinner<'info>>,
    pool_id: u64,
) -> Result<()> {
    let lottery_pool = &mut ctx.accounts.lottery_pool;
    let draw_history = &mut ctx.accounts.draw_history;
    let global_state = &ctx.accounts.global_state;
    let clock = Clock::get()?;

    // Check if crank account is whitelisted (only whitelisted creators can draw pools)
    require!(
        global_state.is_creator_whitelisted(&ctx.accounts.crank.key()),
        crate::FortuneXError::Unauthorized
    );

    // Validate pool is ready for draw
    require!(
        lottery_pool.status != PoolStatus::Completed,
        FortuneXError::PoolDrawCompleted
    );

    // Check if draw time has arrived
    require!(
        clock.unix_timestamp >= lottery_pool.draw_time,
        FortuneXError::DrawTimeNotReached
    );

    // Check if pool has minimum number of tickets sold
    // if not, increase draw time
    if (lottery_pool.tickets_sold.len() as u64) < lottery_pool.min_tickets {
        lottery_pool.draw_time = clock.unix_timestamp + lottery_pool.draw_interval;

        msg!("Updated draw time of pool {}", pool_id);

        return Ok(()); // return early
    }

    // Validate that remaining accounts match participants
    require!(
        ctx.remaining_accounts.len() == lottery_pool.tickets_sold.len(),
        FortuneXError::InvalidRemainingAccountsCount
    );

    // Generate random seed using clock and pool data
    let random_seed = {
        let mut seed = [0u8; 32];
        let clock_bytes = clock.slot.to_le_bytes();
        let pool_bytes = pool_id.to_le_bytes();
        let slot_bytes = clock.slot.to_le_bytes();

        // Combine different entropy sources
        seed[0..8].copy_from_slice(&clock_bytes);
        seed[8..16].copy_from_slice(&pool_bytes);
        seed[16..24].copy_from_slice(&slot_bytes);
        seed[24..32].copy_from_slice(&lottery_pool.created_at.to_le_bytes());

        seed
    };

    // Select random winner (ticket number 1-10)
    let random_value = u64::from_le_bytes([
        random_seed[0],
        random_seed[1],
        random_seed[2],
        random_seed[3],
        random_seed[4],
        random_seed[5],
        random_seed[6],
        random_seed[7],
    ]);
    let winning_ticket = random_value % lottery_pool.tickets_sold.len() as u64;
    let winner_index = winning_ticket as usize;
    let winner = lottery_pool.tickets_sold[winner_index];

    let accounts: Vec<_> = ctx.remaining_accounts.iter().collect();

    // Get the winner's token account from remaining accounts
    let winner_token_account = accounts[winner_index];

    // Verify this is the correct ATA for the winner
    let expected_ata = anchor_spl::associated_token::get_associated_token_address(
        &winner,
        &&ctx.accounts.global_state.usdc_mint.key(),
    );

    require!(
        winner_token_account.key() == expected_ata,
        FortuneXError::InvalidWinnerTokenAccount
    );

    // Verify the account is owned by the token program
    require!(
        winner_token_account.owner == &anchor_spl::token::ID,
        FortuneXError::InvalidWinnerTokenAccount
    );

    // Calculate prize distribution
    // Reduce related fees
    let total_prize = lottery_pool.prize_pool;
    // Calculate platform fee from prize pool using basis points (bps)
    // bps = 100 bps means 1% platform fee, 1000 bps means 10%, 10,000 bps means 100%
    // Example: if platform_fee_bps = 100 (1%), and total_prize = 100_000_000 (100 USDC),
    // platform_fee = (100_000_000 * 100) / 10000 = 1_000_000 (1 USDC)
    let platform_fee = (total_prize * global_state.platform_fee_bps as u64) / 10000;
    let mut winner_prize = total_prize - platform_fee;
    // deduct bonus pool fee
    let bonus_pool_fee = (total_prize * global_state.bonus_pool_fee_bps as u64) / 10000;
    winner_prize -= bonus_pool_fee;

    // deduct pool creator fee
    let commission = (total_prize * lottery_pool.commission_bps as u64) / 10000;
    winner_prize -= commission;

    // Create vault authority signer seeds
    let vault_authority_seeds = &[
        b"vault_authority".as_ref(),
        &pool_id.to_le_bytes(),
        &[ctx.bumps.vault_authority],
    ];
    let vault_signer = &[&vault_authority_seeds[..]];

    // Transfer prize to winner
    let transfer_to_winner = Transfer {
        from: ctx.accounts.pool_token_account.to_account_info(),
        to: winner_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };

    let winner_cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_to_winner,
        vault_signer,
    );

    token::transfer(winner_cpi_ctx, winner_prize)?;

    // Transfer platform fee
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

    token::transfer(platform_cpi_ctx, platform_fee)?;

    // Transfer bonus pool fee
    let transfer_to_bonus_pool = Transfer {
        from: ctx.accounts.pool_token_account.to_account_info(),
        to: ctx.accounts.bonus_pool_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };

    let bonus_cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_to_bonus_pool,
        vault_signer,
    );

    token::transfer(bonus_cpi_ctx, bonus_pool_fee)?;

    // Transfer commission to pool creator
    let transfer_to_creator = Transfer {
        from: ctx.accounts.pool_token_account.to_account_info(),
        to: ctx.accounts.creator_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };

    let commission_cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_to_creator,
        vault_signer,
    );

    token::transfer(commission_cpi_ctx, commission)?;

    // Update lottery pool status and winner details
    lottery_pool.status = PoolStatus::Completed;
    lottery_pool.winner = winner;

    // Record draw history
    draw_history.pool = lottery_pool.key();
    draw_history.pool_id = pool_id;
    draw_history.winner = winner;
    draw_history.prize_amount = winner_prize;
    draw_history.total_tickets = lottery_pool.tickets_sold.len() as u64;
    draw_history.draw_timestamp = clock.unix_timestamp;
    draw_history.winning_ticket = winning_ticket;
    draw_history.random_seed = random_seed;
    draw_history.bump = ctx.bumps.draw_history;

    msg!(
        "Draw completed for pool {}: Winner {} (ticket #{}) won {} USDC",
        pool_id,
        winner,
        winning_ticket,
        winner_prize
    );

    Ok(())
}

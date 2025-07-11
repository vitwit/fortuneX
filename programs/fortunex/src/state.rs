use anchor_lang::prelude::*;
use crate::enums::PoolStatus;

// Global program state
#[account]
#[derive(InitSpace)]
pub struct GlobalState {
    pub authority: Pubkey,           // Program authority
    pub platform_wallet: Pubkey,    // Where 1% fees go
    pub usdc_mint: Pubkey,          // USDC mint address
    pub platform_fee_bps: u16,     // Platform fee in basis points (100 bps = 1%)
    pub bump: u8,
}

// Individual lottery pool - fixed $100 total, 10 tickets
#[account]
#[derive(InitSpace)]
pub struct LotteryPool {
    pub status: PoolStatus,         // Current pool status
    pub prize_pool: u64,            // Total USDC in pool (max $100)
    #[max_len(10)]
    pub participants: Vec<Pubkey>,  // List of participant wallets (max 10)
    pub tickets_sold: u64,          // Number of tickets sold (max 10)
    pub draw_interval: i64,         // Draw interval in seconds (e.g., 24 hours)
    pub draw_time: i64,             // Next draw timestamp
    pub round_number: u64,          // Current round number
    pub bump: u8,
}

impl LotteryPool {
    pub const MAX_PARTICIPANTS: usize = 10; // Exactly 10 participants per round
}

// User's ticket entry for the pool
#[account]
#[derive(InitSpace)]
pub struct UserTicket {
    pub user: Pubkey,               // Ticket owner
    pub pool: Pubkey,               // Pool this ticket belongs to
    pub round_number: u64,          // Round when ticket was bought
    pub ticket_number: u64,         // Single ticket number (1-10)
    pub amount_paid: u64,           // USDC paid ($10)
    pub timestamp: i64,             // When ticket was bought
    pub bump: u8,
}

impl UserTicket {
    pub const MAX_TICKETS_PER_USER: usize = 1; // One ticket per user
}

// Pool's token account to hold USDC
#[account]
#[derive(InitSpace)]
pub struct PoolVault {
    pub pool: Pubkey,               // Associated pool
    pub vault_authority: Pubkey,    // PDA authority for vault
    pub bump: u8,
}

// Draw history for transparency
#[account]
#[derive(InitSpace)]
pub struct DrawHistory {
    pub pool: Pubkey,               // Pool this draw belongs to
    pub round_number: u64,          // Round number
    pub winner: Pubkey,             // Winner address
    pub prize_amount: u64,          // Amount won
    pub total_participants: u64,    // Total participants in draw
    pub total_tickets: u64,         // Total tickets in draw
    pub draw_timestamp: i64,        // When draw occurred
    pub winning_ticket: u64,        // Winning ticket number
    pub random_seed: [u8; 32],      // Random seed used
    pub bump: u8,
}
use crate::enums::PoolStatus;
use crate::FortuneXError;
use anchor_lang::prelude::*;

// Global program state
#[account]
#[derive(InitSpace)]
pub struct GlobalState {
    pub authority: Pubkey,       // Program authority
    pub platform_wallet: Pubkey, // Where 1% fees go
    pub usdc_mint: Pubkey,       // USDC mint address
    pub platform_fee_bps: u16,   // Platform fee in basis points (100 bps = 1%)
    pub pools_count: u64,        // Total number of pools created
    #[max_len(100)] // Max 100 whitelisted creators
    pub creators_whitelist: Vec<Pubkey>, // Accounts allowed to create pools
    pub bump: u8,
}

impl GlobalState {
    pub const MAX_CREATORS: usize = 100; // Maximum number of whitelisted creators

    // Check if a pubkey is in the creators whitelist
    pub fn is_creator_whitelisted(&self, creator: &Pubkey) -> bool {
        self.creators_whitelist.contains(creator)
    }

    // Add a creator to the whitelist (only authority can do this)
    pub fn add_creator(&mut self, creator: Pubkey) -> Result<()> {
        require!(
            !self.creators_whitelist.contains(&creator),
            FortuneXError::CreatorAlreadyWhitelisted
        );
        require!(
            self.creators_whitelist.len() < Self::MAX_CREATORS,
            FortuneXError::WhitelistFull
        );
        self.creators_whitelist.push(creator);
        Ok(())
    }

    // Remove a creator from the whitelist (only authority can do this)
    pub fn remove_creator(&mut self, creator: &Pubkey) -> Result<()> {
        if let Some(pos) = self.creators_whitelist.iter().position(|x| x == creator) {
            self.creators_whitelist.remove(pos);
            Ok(())
        } else {
            Err(FortuneXError::CreatorNotWhitelisted.into())
        }
    }
}

// Individual lottery pool - fixed $100 total, 10 tickets
#[account]
#[derive(InitSpace)]
pub struct LotteryPool {
    pub pool_id: u64,       // Unique pool ID (from global pools_count)
    pub status: PoolStatus, // Current pool status
    pub prize_pool: u64,    // Total USDC in pool (max $100)
    #[max_len(10)]
    pub participants: Vec<Pubkey>, // List of participant wallets (max 10)
    pub tickets_sold: u64,  // Number of tickets sold (max 10)
    pub draw_interval: i64, // Draw interval in seconds (e.g., 24 hours)
    pub draw_time: i64,     // Next draw timestamp
    pub created_at: i64,    // When pool was created
    pub bump: u8,
}

impl LotteryPool {
    pub const MAX_PARTICIPANTS: usize = 5; // Exactly 10 participants per round
    pub const TICKET_PRICE: u64 = 10_000_000; // $10 USDC (6 decimals)
    pub const MAX_PRIZE_POOL: u64 = 10_000_000; // $100 USDC (6 decimals)
}

// User's ticket entry for the pool
#[account]
#[derive(InitSpace)]
pub struct UserTicket {
    pub user: Pubkey, // Ticket owner
    pub pool: Pubkey, // Pool this ticket belongs to
    pub pool_id: u64, // Pool ID for easier querying
    #[max_len(100)]
    pub tickets: Vec<TicketDetails>, // Tickets bought by user
    pub bump: u8,
}

impl UserTicket {
    pub const MAX_TICKETS_PER_USER: usize = 1; // One ticket per user per pool
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct TicketDetails {
    pub ticket_number: u64, // Single ticket number (1-10)
    pub amount_paid: u64,   // USDC paid ($10)
    pub timestamp: i64,     // When ticket was bought
}

// Pool's token account to hold USDC
#[account]
#[derive(InitSpace)]
pub struct PoolVault {
    pub pool: Pubkey,            // Associated pool
    pub pool_id: u64,            // Pool ID for easier identification
    pub vault_authority: Pubkey, // PDA authority for vault
    pub bump: u8,
}

// Draw history for transparency
#[account]
#[derive(InitSpace)]
pub struct DrawHistory {
    pub pool: Pubkey,            // Pool this draw belongs to
    pub pool_id: u64,            // Pool ID
    pub winner: Pubkey,          // Winner address
    pub prize_amount: u64,       // Amount won
    pub total_participants: u64, // Total participants in draw
    pub total_tickets: u64,      // Total tickets in draw
    pub draw_timestamp: i64,     // When draw occurred
    pub winning_ticket: u64,     // Winning ticket number
    pub random_seed: [u8; 32],   // Random seed used
    pub bump: u8,
}

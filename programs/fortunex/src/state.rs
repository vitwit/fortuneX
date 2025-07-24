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
    pub bonus_pool_fee_bps: u16, // Bonus pool fee in basis points (100 bps = 1%)
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

// Individual lottery pool
#[account]
#[derive(InitSpace)]
pub struct LotteryPool {
    pub pool_id: u64,       // Unique pool ID (from global pools_count)
    pub status: PoolStatus, // Current pool status
    pub prize_pool: u64,    // Total USDC in pool
    pub ticket_price: u64,  // Price of each ticket
    #[max_len(100)]
    pub tickets_sold: Vec<Pubkey>, // List of tickets sold
    pub min_tickets: u64,   // Minimum number of tickets need to be sold in pool
    pub max_tickets: u64,   // Maximum number of tickets in pool
    pub draw_interval: i64, // Draw interval in seconds (e.g., 24 hours)
    pub draw_time: i64,     // Next draw timestamp
    pub created_at: i64,    // When pool was created
    pub winner: Pubkey,     // Winner of the pool
    pub commission_bps: u16, // Commission in basis points (100 bps = 1%)
    pub creator: Pubkey,    // Creator of the pool
    pub bump: u8,
    #[max_len(100)]
    pub cancelled_tickets: Vec<u64> // list of cancelled tickets in pool
}

impl LotteryPool {
    pub const DEFAULT_COMMISSION_BPS: u16 = 0; // set no commission for the pool
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
    pub pool: Pubkey,          // Pool this draw belongs to
    pub pool_id: u64,          // Pool ID
    pub winner: Pubkey,        // Winner address
    pub prize_amount: u64,     // Amount won
    pub total_tickets: u64,    // Total tickets in draw
    pub draw_timestamp: i64,   // When draw occurred
    pub winning_ticket: u64,   // Winning ticket number
    pub random_seed: [u8; 32], // Random seed used
    pub bump: u8,
}

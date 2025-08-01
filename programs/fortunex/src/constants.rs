// Pool configuration constants
pub const MAX_POOL_AMOUNT: u64 = 100_000_000; // $100 USDC total pool cap (6 decimals)
pub const TOTAL_TICKETS: u64 = 10;             // Fixed 10 tickets per round
pub const TICKET_PRICE: u64 = 10_000_000;     // $10 USDC per ticket (100/10)

// PDA Seeds
pub const GLOBAL_STATE_SEED: &[u8] = b"global_state";
pub const BONUS_AUTHORITY_SEED: &[u8] = b"bonus_authority";
pub const LOTTERY_POOL_SEED: &[u8] = b"lottery_pool";
pub const USER_TICKET_SEED: &[u8] = b"user_ticket";
pub const POOL_VAULT_SEED: &[u8] = b"pool_vault";
pub const VAULT_AUTHORITY_SEED: &[u8] = b"vault_authority";
pub const DRAW_HISTORY_SEED: &[u8] = b"draw_history";

// Platform fee configuration
pub const DEFAULT_PLATFORM_FEE_BPS: u16 = 100; // 1% (100 basis points)
pub const MAX_PLATFORM_FEE_BPS: u16 = 1000;    // 10% maximum allowed
pub const MAX_BONUS_POOL_FEE_BPS: u16 = 1000;    // 10% maximum allowed

// Draw configuration
pub const DEFAULT_DRAW_INTERVAL: i64 = 24 * 60 * 60; // 24 hours in seconds
pub const MIN_DRAW_INTERVAL: i64 = 60 * 60;          // 1 hour minimum
pub const MAX_DRAW_INTERVAL: i64 = 7 * 24 * 60 * 60; // 7 days maximum
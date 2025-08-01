// bot-config.ts
export interface BotConfig {
  // Bot settings
  BOT_COUNT: number;
  TICKETS_PER_BOT: number;
  MAX_TICKETS_PER_PURCHASE: number;
  MIN_TICKETS_PER_PURCHASE: number;

  // Pool settings
  POOL_MAX_TICKETS: number;
  TICKET_PRICE_USD: number;
  POOL_PRIZE_USD: number;

  // Timing settings
  DRAW_CHECK_INTERVAL: string; // cron format
  BOT_BUY_INTERVAL: string; // cron format
  PURCHASE_DELAY_MS: number; // delay between bot purchases

  // File paths
  BOTS_FILE: string;

  // Network settings
  FUNDING_BUFFER_MULTIPLIER: number; // Extra funding buffer for gas fees
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
  // 20 bots, each buying up to 5000 tickets = 100,000 total tickets
  BOT_COUNT: 20,
  TICKETS_PER_BOT: 5,
  MAX_TICKETS_PER_PURCHASE: 5, // Each purchase: 1-100 tickets
  MIN_TICKETS_PER_PURCHASE: 1,

  // Pool configuration matching your requirements
  POOL_MAX_TICKETS: 100, // 100K tickets
  TICKET_PRICE_USD: 1000, // $10 per ticket
  POOL_PRIZE_USD: 100000, // $1M prize pool

  // Cron schedules
  DRAW_CHECK_INTERVAL: "0 */30 * * * *", // Every 30 minutes
  BOT_BUY_INTERVAL: "0 0 */3 * * *", // Every 2 hours
  PURCHASE_DELAY_MS: 300000, // 5 minutes delay between purchases

  // File paths
  BOTS_FILE: "./bots.json",

  // Network
  FUNDING_BUFFER_MULTIPLIER: 1.1, // 10% extra for gas fees
};

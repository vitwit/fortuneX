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
  TICKET_PRICE_USD: 100, // $10 per ticket
  POOL_PRIZE_USD: 10000, // $1M prize pool

  // Cron schedules
  DRAW_CHECK_INTERVAL: "*/30 * * * * *", // Every 30 seconds
  BOT_BUY_INTERVAL: "*/10 * * * * *", // Every 10 seconds
  PURCHASE_DELAY_MS: 1000, // 100ms delay between purchases

  // File paths
  BOTS_FILE: "./bots.json",

  // Network
  FUNDING_BUFFER_MULTIPLIER: 1.1, // 10% extra for gas fees
};

// You can create different configs for different environments
export const DEMO_CONFIG: BotConfig = {
  ...DEFAULT_BOT_CONFIG,
  BOT_COUNT: 10, // Fewer bots for demo
  TICKETS_PER_BOT: 1000, // Fewer tickets per bot
  BOT_BUY_INTERVAL: "*/5 * * * * *", // More frequent buying (every 5 seconds)
  MAX_TICKETS_PER_PURCHASE: 50,
};

export const PRODUCTION_CONFIG: BotConfig = {
  ...DEFAULT_BOT_CONFIG,
  BOT_BUY_INTERVAL: "*/30 * * * * *", // Less frequent in production
  PURCHASE_DELAY_MS: 500, // Longer delays in production
};

import { FortuneXClient } from "../client/client";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import cron from "node-cron";
import { BotConfig, DEFAULT_BOT_CONFIG } from "./bot-config";

// Choose your configuration here
const CONFIG: BotConfig = DEFAULT_BOT_CONFIG;
const POOL_INTERVAL = 86_400;

interface Bot {
  keypair: number[]; // Serialized keypair
  publicKey: string;
  // Bot persona for varied behavior
  maxTicketsPerPurchase: number; // Each bot has its own max (1-5)
  skipProbability: number; // Chance to skip a pool (0.0-0.3)
}

class LotteryBotManager {
  private client: FortuneXClient;
  private authority: Keypair;
  private bots: Bot[] = [];
  private botKeypairs: Keypair[] = [];
  private globalState: any = null; // Store global state here
  private usdcMint: PublicKey | null = null; // Cache USDC mint
  private readonly MIN_SOL_BALANCE = 0.1; // Minimum SOL balance threshold
  private readonly SOL_AIRDROP_AMOUNT = 1; // Amount of SOL to airdrop

  constructor(client: FortuneXClient, authority: Keypair) {
    this.client = client;
    this.authority = authority;
  }

  // Initialize platform state once at startup
  private async initializePlatformState(): Promise<boolean> {
    try {
      console.log("🔄 Initializing platform state...");
      const { globalState } = await this.client.isPlatformInitialized();

      if (!globalState) {
        console.error("❌ Platform not initialized");
        return false;
      }

      this.globalState = globalState;
      this.usdcMint = globalState.usdcMint;

      console.log("✅ Platform state initialized successfully");
      console.log(`💰 USDC Mint: ${this.usdcMint?.toBase58()}`);

      return true;
    } catch (error: any) {
      console.error("❌ Failed to initialize platform state:", error.message);
      return false;
    }
  }

  // Initialize or load existing bots
  async initializeBots(): Promise<void> {
    // First initialize platform state
    const platformInitialized = await this.initializePlatformState();
    if (!platformInitialized) {
      throw new Error("Failed to initialize platform state");
    }

    if (existsSync(CONFIG.BOTS_FILE)) {
      console.log("🤖 Loading existing bots...");
      const botsData = JSON.parse(readFileSync(CONFIG.BOTS_FILE, "utf-8"));
      this.bots = botsData;

      // Recreate keypairs from stored data
      this.botKeypairs = this.bots.map((bot) =>
        Keypair.fromSecretKey(new Uint8Array(bot.keypair))
      );

      console.log(`✅ Loaded ${this.bots.length} existing bots`);
    } else {
      console.log("🤖 Creating new bots...");
      await this.createBots();
      this.saveBots();
    }

    // Fund all bots with SOL only initially (for transaction fees)
    await this.fundBotsWithSOL();
  }

  // Create new bot keypairs
  private async createBots(): Promise<void> {
    for (let i = 0; i < CONFIG.BOT_COUNT; i++) {
      const keypair = Keypair.generate();
      this.botKeypairs.push(keypair);

      const bot: Bot = {
        keypair: Array.from(keypair.secretKey),
        publicKey: keypair.publicKey.toBase58(),
        // Randomize bot behavior to make it less suspicious
        maxTicketsPerPurchase: Math.floor(Math.random() * 5) + 1, // 1-5 tickets
        skipProbability: Math.random() * 0.3, // 0-30% chance to skip pools
      };

      this.bots.push(bot);
      console.log(
        `🤖 Created bot ${i + 1}: ${bot.publicKey.slice(0, 8)}... (max: ${
          bot.maxTicketsPerPurchase
        } tickets, skip: ${(bot.skipProbability * 100).toFixed(0)}%)`
      );
    }
  }

  // Save bots to file
  private saveBots(): void {
    writeFileSync(CONFIG.BOTS_FILE, JSON.stringify(this.bots, null, 2));
    console.log("💾 Bots saved to file");
  }

  // Fund all bots with SOL for transaction fees
  private async fundBotsWithSOL(): Promise<void> {
    console.log("⛽ Funding bots with SOL for transaction fees...");

    for (let i = 0; i < this.botKeypairs.length; i++) {
      try {
        await this.fundBotWithSOLIfNeeded(this.botKeypairs[i], i + 1);
      } catch (error: any) {
        console.log(`❌ Failed to fund bot ${i + 1} with SOL:`, error.message);
      }
    }
  }

  // Check and fund individual bot with SOL if needed
  private async fundBotWithSOLIfNeeded(
    botKeypair: Keypair,
    botNumber: number
  ): Promise<boolean> {
    try {
      // Check current SOL balance
      const balance = await this.client.provider.connection.getBalance(
        botKeypair.publicKey
      );
      const solBalance = balance / 10 ** 9;

      // Only airdrop if balance is low (less than MIN_SOL_BALANCE)
      if (solBalance < this.MIN_SOL_BALANCE) {
        console.log(
          `⛽ Bot ${botNumber} SOL balance low (${solBalance.toFixed(
            3
          )} SOL), requesting airdrop...`
        );

        await this.client.provider.connection.requestAirdrop(
          botKeypair.publicKey,
          this.SOL_AIRDROP_AMOUNT * 10 ** 9 // Convert to lamports
        );

        // Wait for confirmation
        await new Promise((resolve) => setTimeout(resolve, 1000));

        console.log(
          `✅ Bot ${botNumber} funded with ${this.SOL_AIRDROP_AMOUNT} SOL for transaction fees`
        );
        return true;
      } else {
        console.log(
          `💰 Bot ${botNumber} already has sufficient SOL (${solBalance.toFixed(
            3
          )} SOL)`
        );
        return true;
      }
    } catch (error: any) {
      console.error(
        `❌ Failed to fund bot ${botNumber} with SOL:`,
        error.message
      );
      return false;
    }
  }

  // Check if bot has sufficient USDC balance
  private async checkBotUSDCBalance(
    botKeypair: Keypair,
    requiredAmount: number
  ): Promise<boolean> {
    try {
      if (!this.usdcMint) {
        console.error("❌ USDC mint not available");
        return false;
      }

      // Get bot's USDC token account
      const botUsdcAccount =
        await this.client.getOrCreateAssociatedTokenAccount(
          this.usdcMint,
          botKeypair.publicKey
        );

      const balance =
        await this.client.provider.connection.getTokenAccountBalance(
          botUsdcAccount
        );
      const currentBalance = balance.value.uiAmount || 0;
      const requiredUSD = requiredAmount / 1_000_000; // Convert from micro USDC to USD

      console.log(
        `💰 Bot ${botKeypair.publicKey
          .toBase58()
          .slice(
            0,
            8
          )}... balance: $${currentBalance}, required: $${requiredUSD}`
      );

      return currentBalance >= requiredUSD;
    } catch (error: any) {
      console.log(`❌ Error checking USDC balance for bot:`, error.message);
      return false;
    }
  }

  // Fund bot with USDC if needed
  private async fundBotWithUSDCIfNeeded(
    botKeypair: Keypair,
    requiredAmount: number
  ): Promise<boolean> {
    try {
      const hasEnoughFunds = await this.checkBotUSDCBalance(
        botKeypair,
        requiredAmount
      );

      if (hasEnoughFunds) {
        return true; // Bot already has enough funds
      }

      console.log(
        `💸 Funding bot ${botKeypair.publicKey
          .toBase58()
          .slice(0, 8)}... with USDC...`
      );

      if (!this.usdcMint) {
        console.error("❌ USDC mint not available");
        return false;
      }

      // Fund with enough USDC for the required amount plus a small buffer
      const fundAmount = Math.floor(
        requiredAmount * CONFIG.FUNDING_BUFFER_MULTIPLIER
      );

      await this.client.mintToATA(
        this.usdcMint,
        botKeypair.publicKey,
        fundAmount,
        this.authority
      );

      console.log(`✅ Bot funded with $${fundAmount / 1_000_000} USDC`);
      return true;
    } catch (error: any) {
      console.error(`❌ Failed to fund bot with USDC:`, error.message);
      return false;
    }
  }

  // Fund bot with both SOL and USDC if needed (combined function)
  private async fundBotIfNeeded(
    botKeypair: Keypair,
    botNumber: number,
    requiredUSDC: number
  ): Promise<boolean> {
    try {
      console.log(`🔍 Checking funding requirements for bot ${botNumber}...`);

      // Check and fund SOL first (needed for transactions)
      const solFunded = await this.fundBotWithSOLIfNeeded(
        botKeypair,
        botNumber
      );
      if (!solFunded) {
        console.error(`❌ Failed to ensure SOL funding for bot ${botNumber}`);
        return false;
      }

      // Then check and fund USDC
      const usdcFunded = await this.fundBotWithUSDCIfNeeded(
        botKeypair,
        requiredUSDC
      );
      if (!usdcFunded) {
        console.error(`❌ Failed to ensure USDC funding for bot ${botNumber}`);
        return false;
      }

      return true;
    } catch (error: any) {
      console.error(`❌ Error funding bot ${botNumber}:`, error.message);
      return false;
    }
  }

  // Check active pools and buy tickets
  async buyTicketsInActivePools(): Promise<void> {
    try {
      const pools = await this.client.program.account.lotteryPool.all();

      for (const { account: pool } of pools) {
        const poolId = pool.poolId.toNumber();

        // Check if pool is active (not completed and not expired)
        if (pool.status.completed || pool.status.poolFull) {
          console.log(`⏭️ Skipping pool ${poolId} - already completed/full`);
          continue;
        }

        const now = Math.floor(Date.now() / 1000);
        const drawTime = pool.drawTime.toNumber();

        if (drawTime <= now) {
          console.log(`⏰ Pool ${poolId} has expired, skipping bot purchases`);
          continue;
        }

        console.log(
          `🎯 Found active pool ${poolId}, checking ticket availability...`
        );

        // Get fresh pool info to check current state
        const poolInfo = await this.client.getPoolInfo(poolId);
        const ticketsSold = poolInfo.ticketsSold?.length || 0;
        const maxTickets = pool.maxTickets.toNumber();
        const availableTickets = maxTickets - ticketsSold;

        console.log(
          `📊 Pool ${poolId} - Sold: ${ticketsSold}, Max: ${maxTickets}, Available: ${availableTickets}`
        );

        if (availableTickets <= 0) {
          console.log(`🎫 Pool ${poolId} is full, no tickets available`);
          continue;
        }

        // Let bots buy tickets
        await this.letBotsBuyTickets(poolId, availableTickets);
      }
    } catch (error: any) {
      console.error("❌ Error in buying tickets:", error.message);
    }
  }

  // Let bots buy tickets in a specific pool
  private async letBotsBuyTickets(
    poolId: number,
    initialAvailableTickets: number
  ): Promise<void> {
    // Shuffle bots to randomize purchase order
    const shuffledBots = [...this.botKeypairs].sort(() => Math.random() - 0.5);

    console.log(`🤖 Starting bot purchases for pool ${poolId}`);

    for (let i = 0; i < shuffledBots.length; i++) {
      const bot = shuffledBots[i];
      const botIndex = this.botKeypairs.findIndex((b) =>
        b.publicKey.equals(bot.publicKey)
      );
      const botConfig = this.bots[botIndex];

      try {
        // Check if this bot should skip this pool
        if (Math.random() < botConfig.skipProbability) {
          console.log(
            `⏭️ Bot ${botIndex + 1} skipping this pool (${(
              botConfig.skipProbability * 100
            ).toFixed(0)}% skip chance)`
          );
          continue;
        }

        // Get fresh pool state before each purchase
        const currentPoolInfo = await this.client.getPoolInfo(poolId);
        const currentTicketsSold = currentPoolInfo.ticketsSold?.length || 0;
        const maxTickets = await this.getPoolMaxTickets(poolId);
        const currentAvailableTickets = maxTickets - currentTicketsSold;

        if (currentAvailableTickets <= 0) {
          console.log(`🚫 Pool ${poolId} is now full, stopping bot purchases`);
          break;
        }

        // Calculate how many tickets this bot should buy (randomized)
        const botMaxTickets = Math.min(
          currentAvailableTickets,
          botConfig.maxTicketsPerPurchase
        );

        // Add some randomness - bot might buy fewer than their max
        const ticketsToBuy = Math.floor(Math.random() * botMaxTickets) + 1;

        if (ticketsToBuy <= 0) {
          console.log(`⏭️ Bot ${botIndex + 1} - no tickets to buy`);
          continue;
        }

        // Calculate required USDC amount for this purchase
        const requiredUSDC = ticketsToBuy * CONFIG.TICKET_PRICE_USD * 1_000_000; // Convert to micro USDC

        console.log(
          `🤖 Bot ${
            botIndex + 1
          } attempting to buy ${ticketsToBuy} tickets for pool ${poolId} (${currentAvailableTickets} available, bot max: ${
            botConfig.maxTicketsPerPurchase
          })`
        );

        // Check and fund bot with both SOL and USDC if needed
        const fundingSuccess = await this.fundBotIfNeeded(
          bot,
          botIndex + 1,
          requiredUSDC
        );
        if (!fundingSuccess) {
          console.error(
            `❌ Failed to fund bot ${botIndex + 1}, skipping purchase`
          );
          continue;
        }

        // Now attempt the purchase
        const tx = await this.client.buyTicket(bot, poolId, ticketsToBuy);

        console.log(
          `✅ Bot ${botIndex + 1} bought ${ticketsToBuy} tickets. TX: ${tx}`
        );

        // Small delay to avoid overwhelming the network
        await new Promise((resolve) =>
          setTimeout(resolve, CONFIG.PURCHASE_DELAY_MS)
        );

        // Check if pool is now full after this purchase
        const updatedPoolInfo = await this.client.getPoolInfo(poolId);
        const updatedTicketsSold = updatedPoolInfo.ticketsSold?.length || 0;
        const updatedAvailableTickets = maxTickets - updatedTicketsSold;

        console.log(
          `📊 After bot ${
            botIndex + 1
          } purchase: ${updatedTicketsSold}/${maxTickets} tickets sold, ${updatedAvailableTickets} remaining`
        );

        if (updatedAvailableTickets <= 0) {
          console.log(`🎉 Pool ${poolId} is now full after bot purchases!`);
          break;
        }
      } catch (error: any) {
        if (
          error.message?.includes("pool is full") ||
          error.message?.includes("insufficient tickets") ||
          error.message?.includes("PoolFull")
        ) {
          console.log(`🚫 Pool ${poolId} became full, stopping bot purchases`);
          break;
        } else {
          console.error(
            `❌ Bot ${botIndex + 1} failed to buy tickets:`,
            error.message
          );
          // Continue with next bot instead of breaking
          continue;
        }
      }
    }

    console.log(`🏁 Finished bot purchases for pool ${poolId}`);
  }

  // Helper function to get pool max tickets
  private async getPoolMaxTickets(poolId: number): Promise<number> {
    try {
      const pools = await this.client.program.account.lotteryPool.all();
      const pool = pools.find((p) => p.account.poolId.toNumber() === poolId);
      return pool ? pool.account.maxTickets.toNumber() : 0;
    } catch (error) {
      console.error(`Error getting max tickets for pool ${poolId}:`, error);
      return 0;
    }
  }

  // Get bot statistics
  async getBotStats(): Promise<{
    totalBots: number;
    fundedBots: number;
    totalFunding: number;
  }> {
    if (!this.globalState) {
      return { totalBots: 0, fundedBots: 0, totalFunding: 0 };
    }

    const totalBots = this.bots.length;
    const totalFunding =
      CONFIG.TICKETS_PER_BOT * CONFIG.TICKET_PRICE_USD * totalBots;

    return {
      totalBots,
      fundedBots: totalBots, // Assume all bots are funded if they exist
      totalFunding,
    };
  }
}

async function main() {
  const client = new FortuneXClient();
  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(readFileSync(`${process.env.ANCHOR_WALLET}`, "utf-8"))
    )
  );

  console.log("🚀 Starting Lottery Bot Manager...");
  console.log("Running for Program:", client.program.programId.toBase58());

  // Initialize bot manager
  const botManager = new LotteryBotManager(client, wallet);
  await botManager.initializeBots();

  // Show bot statistics
  const stats = await botManager.getBotStats();
  console.log("📊 Bot Statistics:");
  console.log(`   Total Bots: ${stats.totalBots}`);
  console.log(`   Total Funding: $${stats.totalFunding.toLocaleString()}`);

  try {
    // Pool drawing cron job
    cron.schedule(CONFIG.DRAW_CHECK_INTERVAL, async () => {
      console.log("🔁 Cron Job: Checking pools for drawing...");
      try {
        let globalState = await client.program.account.globalState.all();
        if (
          globalState?.[0]?.account?.creatorsWhitelist?.some((key) =>
            key.equals(wallet.publicKey)
          )
        ) {
          await drawPools(client, wallet);
        } else {
          console.log(
            "🚫 Unauthorized to run crank or contract may not be initialized yet"
          );
        }
      } catch (err: any) {
        console.error("❌ Error in draw pools cron job:", err.message);
      }
    });

    // Bot ticket buying cron job
    cron.schedule(CONFIG.BOT_BUY_INTERVAL, async () => {
      console.log("🤖 Bot Cron Job: Checking for ticket purchases...");
      try {
        await botManager.buyTicketsInActivePools();
      } catch (err: any) {
        console.error("❌ Error in bot ticket buying cron job:", err.message);
      }
    });

    console.log("✅ All cron jobs started successfully!");
    console.log(`🎯 Pool drawing: ${CONFIG.DRAW_CHECK_INTERVAL}`);
    console.log(`🤖 Bot ticket buying: ${CONFIG.BOT_BUY_INTERVAL}`);
    console.log(
      `🤖 Bot configuration: ${CONFIG.BOT_COUNT} bots, max ${CONFIG.MAX_TICKETS_PER_PURCHASE} tickets per purchase`
    );
  } catch (err: any) {
    console.error("❌ Failed to run cron jobs:", err.message);
  }
}

async function drawPools(client: FortuneXClient, wallet: Keypair) {
  let pools = await client.program.account.lotteryPool.all();
  console.log("📊 Total number of pools:", pools.length);

  for (const { publicKey: poolPda, account: pool } of pools) {
    const now = Math.floor(Date.now() / 1000);
    const poolId = pool.poolId.toNumber();
    const drawTime = pool.drawTime.toNumber();

    // Skip if not ready to draw or already completed
    if (drawTime > now || pool.status.completed) continue;

    console.log(`🎯 Drawing for Pool ID: ${poolId}`);

    try {
      const drawResult = await client.drawWinner(wallet, poolId);
      let info = await client.getPoolInfo(poolId);

      if (info.status.completed) {
        console.log("🏆 Draw completed!");
        console.log(`   Winner: ${drawResult.drawHistory.winner.toBase58()}`);
        console.log(
          `   Prize: ${drawResult.drawHistory.prizeAmount.toString()}`
        );
        console.log("🆕 Initializing new pool...");

        const newPool = await client.createLotteryPool(wallet, POOL_INTERVAL);
        console.log(`✅ New pool created with ID: ${newPool.poolId}`);
      } else {
        console.log(
          `⏰ Draw time of Pool ${poolId} extended due to insufficient sold tickets`
        );
      }
    } catch (err: any) {
      console.log(`❌ Error when drawing pool ${poolId}:`, err.message);
      continue;
    }
  }
}

main().catch(console.error);

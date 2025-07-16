import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fortunex } from "../target/types/fortunex";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint } from "@solana/spl-token";
import { readFileSync } from "fs";

export class FortuneXClient {
  private program: Program<Fortunex>;
  private provider: anchor.Provider;

  // Seeds
  private readonly GLOBAL_STATE_SEED = "global_state";
  private readonly LOTTERY_POOL_SEED = "lottery_pool";
  private readonly VAULT_AUTHORITY_SEED = "vault_authority";

  constructor() {
    anchor.setProvider(anchor.AnchorProvider.env());
    this.program = anchor.workspace.fortunex as Program<Fortunex>;
    this.provider = anchor.getProvider();
  }

  /**
   * Initialize the platform with global state
   */
  async initializePlatform(
    authority: Keypair,
    platformWallet: PublicKey,
    usdcMint: PublicKey,
    platformFeePercentage: number = 100 // 1% (100 basis points)
  ): Promise<string> {
    try {
      // Airdrop SOL to authority if needed
      await this.provider.connection.requestAirdrop(
        authority.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Find global state PDA
      const [globalStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from(this.GLOBAL_STATE_SEED)],
        this.program.programId
      );

      // Initialize program
      const tx = await this.program.methods
        .initialize(platformWallet, usdcMint, platformFeePercentage)
        .accounts({
          globalState: globalStatePda,
          usdcMint: usdcMint,
          authority: authority.publicKey,
          platformWallet: platformWallet,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([authority])
        .rpc();

      console.log("✅ Platform initialized with transaction:", tx);

      // Verify initialization
      const globalState = await this.program.account.globalState.fetch(
        globalStatePda
      );
      console.log("🔍 Global state:", {
        authority: globalState.authority.toBase58(),
        platformWallet: globalState.platformWallet.toBase58(),
        usdcMint: globalState.usdcMint.toBase58(),
        platformFeeBps: globalState.platformFeeBps,
        poolsCount: globalState.poolsCount.toString(),
      });

      return tx;
    } catch (error) {
      console.error("❌ Error initializing platform:", error);
      throw error;
    }
  }

  /**
   * Create a new lottery pool
   */
  async createLotteryPool(
    creator: Keypair,
    drawInterval: number = 86400, // 24 hours in seconds
    poolId?: number
  ): Promise<{ txSignature: string; poolPda: PublicKey; poolId: number }> {
    try {
      // Airdrop SOL to creator if needed
      await this.provider.connection.requestAirdrop(
        creator.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Find global state PDA
      const [globalStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from(this.GLOBAL_STATE_SEED)],
        this.program.programId
      );

      // Get current pools count if poolId not provided
      let currentPoolId = poolId;
      if (currentPoolId === undefined) {
        const globalState = await this.program.account.globalState.fetch(
          globalStatePda
        );
        currentPoolId = globalState.poolsCount.toNumber();
      }

      // Find pool PDAs
      const [lotteryPoolPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from(this.LOTTERY_POOL_SEED),
          new anchor.BN(currentPoolId).toArrayLike(Buffer, "le", 8),
        ],
        this.program.programId
      );

      const [vaultAuthority] = PublicKey.findProgramAddressSync(
        [
          Buffer.from(this.VAULT_AUTHORITY_SEED),
          new anchor.BN(currentPoolId).toArrayLike(Buffer, "le", 8),
        ],
        this.program.programId
      );

      const [poolTokenAccount] = PublicKey.findProgramAddressSync(
        [
          Buffer.from(this.VAULT_AUTHORITY_SEED),
          new anchor.BN(currentPoolId).toArrayLike(Buffer, "le", 8),
        ],
        this.program.programId
      );

      // Get USDC mint from global state
      const globalState = await this.program.account.globalState.fetch(
        globalStatePda
      );
      const usdcMint = globalState.usdcMint;

      // Create lottery pool
      const tx = await this.program.methods
        .initializePool(new anchor.BN(drawInterval))
        .accounts({
          globalState: globalStatePda,
          lotteryPool: lotteryPoolPda,
          poolTokenAccount: poolTokenAccount,
          vaultAuthority: vaultAuthority,
          usdcMint: usdcMint,
          authority: creator.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([creator])
        .rpc();

      console.log("✅ Pool created with transaction:", tx);

      // Verify pool creation
      const pool = await this.program.account.lotteryPool.fetch(lotteryPoolPda);
      console.log("🔍 Pool details:", {
        poolId: pool.poolId.toString(),
        // creator: pool.creator.toBase58(),
        drawInterval: pool.drawInterval.toString(),
        // nextDrawTime: new Date(pool.nextDrawTime.toNumber() * 1000).toISOString(),
        ticketsSold: pool.ticketsSold.toString(),
        // isActive: pool.isActive
      });

      return {
        txSignature: tx,
        poolPda: lotteryPoolPda,
        poolId: currentPoolId,
      };
    } catch (error) {
      console.error("❌ Error creating lottery pool:", error);
      throw error;
    }
  }

  /**
   * Helper method to create USDC mint (for testing)
   */
  async createUSDCMint(authority: Keypair): Promise<PublicKey> {
    try {
      const usdcMint = await createMint(
        this.provider.connection,
        authority,
        authority.publicKey,
        authority.publicKey,
        6 // USDC decimals
      );

      console.log("✅ USDC mint created:", usdcMint.toBase58());
      return usdcMint;
    } catch (error) {
      console.error("❌ Error creating USDC mint:", error);
      throw error;
    }
  }

  /**
   * Get global state information
   */
  async getGlobalState() {
    try {
      const [globalStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from(this.GLOBAL_STATE_SEED)],
        this.program.programId
      );

      const globalState = await this.program.account.globalState.fetch(
        globalStatePda
      );
      return {
        pda: globalStatePda,
        data: globalState,
      };
    } catch (error) {
      console.error("❌ Error fetching global state:", error);
      throw error;
    }
  }

  /**
   * Get lottery pool information
   */
  async getLotteryPool(poolId: number) {
    try {
      const [lotteryPoolPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from(this.LOTTERY_POOL_SEED),
          new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
        ],
        this.program.programId
      );

      const pool = await this.program.account.lotteryPool.fetch(lotteryPoolPda);
      return {
        pda: lotteryPoolPda,
        data: pool,
      };
    } catch (error) {
      console.error("❌ Error fetching lottery pool:", error);
      throw error;
    }
  }
}

// Usage example
async function main() {
  const client = new FortuneXClient();

  // Generate keypairs
  const authority = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(readFileSync(`${process.env.ANCHOR_WALLET}`, "utf-8"))
    )
  );

  const platformWallet = authority;
  const creator = authority;

  try {
    // 1. Create USDC mint
    const usdcMint = await client.createUSDCMint(authority);

     // 2. Initialize platform
    // await client.initializePlatform(
      // authority,
      // platformWallet.publicKey,
      //usdcMint,
      //100 // 1% platform fee
  //);

    // 3. Create lottery pool
    const poolResult = await client.createLotteryPool(
      creator,
      86400 // 24 hours
    );

    console.log("🎉 Setup complete!");
    console.log("Pool ID:", poolResult.poolId);
    console.log("Pool PDA:", poolResult.poolPda.toBase58());
  } catch (error) {
    console.error("Setup failed:", error);
  }
}

// Uncomment to run the example
main().catch(console.error);

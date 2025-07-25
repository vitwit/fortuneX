import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fortunex } from "../target/types/fortunex"; // You'll need to copy this type file
import {
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  Connection,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createMint,
  getAccount,
  getAssociatedTokenAddress,
  mintTo,
  createAccount,
} from "@solana/spl-token";
import { readFileSync } from "fs";
import express from "express";

export class FortuneXClient {
  public program: Program<Fortunex>;
  public provider: anchor.Provider;
  public creatorTokenAccount: anchor.web3.PublicKey;

  // Your deployed program ID - this will be read from the IDL
  // private readonly PROGRAM_ID = new PublicKey("YOUR_PROGRAM_ID_HERE");

  // Seeds
  private readonly GLOBAL_STATE_SEED = "global_state";
  private readonly LOTTERY_POOL_SEED = "lottery_pool";
  private readonly VAULT_AUTHORITY_SEED = "vault_authority";
  private readonly USER_TICKET_SEED = "user_ticket";

  constructor(connection?: Connection, wallet?: anchor.Wallet) {
    // Option 1: Use provided connection and wallet
    if (connection && wallet) {
      this.provider = new anchor.AnchorProvider(
        connection,
        wallet,
        anchor.AnchorProvider.defaultOptions()
      );
    } else {
      // Option 2: Use environment provider (requires ANCHOR_PROVIDER_URL and ANCHOR_WALLET)
      this.provider = anchor.AnchorProvider.env();
    }

    anchor.setProvider(this.provider);

    // Load the IDL - the program ID is embedded in the IDL
    try {
      const idl = JSON.parse(
        readFileSync("./idl/fortunex.json", "utf8")
      );
      // Program constructor: new Program(idl, provider?, coder?, getCustomResolver?)
      this.program = new Program(idl, this.provider);

      // The program ID comes from the IDL
      console.log("Program ID from IDL:", this.program.programId.toString());
    } catch (error) {
      console.error("Could not load IDL from file:", error);
      throw new Error("Failed to initialize program with IDL");
    }
  }

  // Alternative constructor method using IDL object directly
  static fromIdl(
    idl: any, // Your IDL object
    connection: Connection,
    wallet: anchor.Wallet
  ): FortuneXClient {
    const provider = new anchor.AnchorProvider(
      connection,
      wallet,
      anchor.AnchorProvider.defaultOptions()
    );
    anchor.setProvider(provider);

    const client = Object.create(FortuneXClient.prototype);
    client.provider = provider;
    client.program = new Program(idl, provider);

    return client;
  }

  // ✅ NEW: Check if platform is already initialized
  async isPlatformInitialized(): Promise<{
    initialized: boolean;
    globalState?: any;
  }> {
    try {
      const [globalStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from(this.GLOBAL_STATE_SEED)],
        this.program.programId
      );

      const globalState = await this.program.account.globalState.fetch(
        globalStatePda
      );
      console.log("🔍 Platform is already initialized!");
      console.log("Global state:", {
        authority: globalState.authority.toBase58(),
        platformWallet: globalState.platformWallet.toBase58(),
        usdcMint: globalState.usdcMint.toBase58(),
        platformFeeBps: globalState.platformFeeBps,
        poolsCount: globalState.poolsCount.toString(),
      });

      return { initialized: true, globalState };
    } catch (error) {
      console.log("📝 Platform not yet initialized");
      return { initialized: false };
    }
  }

  async initializePlatform(
    authority: Keypair,
    platformWallet: PublicKey,
    usdcMint: PublicKey,
    platformFeePercentage: number = 100
  ): Promise<string> {
    const [globalStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from(this.GLOBAL_STATE_SEED)],
      this.program.programId
    );

    const tx = await this.program.methods
      .initialize(platformWallet, usdcMint, 50, 50)
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
  }

  // ✅ NEW: Check if pool exists
  async doesPoolExist(poolId: number): Promise<boolean> {
    try {
      const [lotteryPoolPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from(this.LOTTERY_POOL_SEED),
          new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
        ],
        this.program.programId
      );

      await this.program.account.lotteryPool.fetch(lotteryPoolPda);
      console.log(`🔍 Pool ${poolId} already exists!`);
      return true;
    } catch (error) {
      console.log(`📝 Pool ${poolId} does not exist yet`);
      return false;
    }
  }

  async createLotteryPool(
    creator: Keypair,
    drawInterval: number = 300, // Default 5 minutes (300 seconds)
    poolId?: number
  ): Promise<{ txSignature: string; poolPda: PublicKey; poolId: number }> {
    const [globalStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from(this.GLOBAL_STATE_SEED)],
      this.program.programId
    );

    let currentPoolId = poolId;
    if (currentPoolId === undefined) {
      const globalState = await this.program.account.globalState.fetch(
        globalStatePda
      );
      currentPoolId = globalState.poolsCount.toNumber();
    }

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

    const globalState = await this.program.account.globalState.fetch(
      globalStatePda
    );
    const usdcMint = globalState.usdcMint;
    // if (!this.creatorTokenAccount) {
    this.creatorTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      creator.publicKey
    );
    // }

    const tx = await this.program.methods
      .initializePool(
        new anchor.BN(10_000_000),
        new anchor.BN(5),
        new anchor.BN(5),
        new anchor.BN(drawInterval)
      )
      .accounts({
        globalState: globalStatePda,
        lotteryPool: lotteryPoolPda,
        poolTokenAccount,
        vaultAuthority,
        usdcMint,
        creatorTokenAccount: this.creatorTokenAccount,
        authority: creator.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([creator])
      .rpc();

    console.log("✅ Pool created with transaction:", tx);

    const pool = await this.program.account.lotteryPool.fetch(lotteryPoolPda);
    console.log("🔍 Pool details:", {
      poolId: pool.poolId.toString(),
      drawInterval: pool.drawInterval.toString(),
      ticketsSold: pool.ticketsSold.toString(),
      createdAt: new Date(pool.createdAt.toNumber() * 1000),
      expiresAt: new Date((pool.createdAt.toNumber() + drawInterval) * 1000),
    });

    return {
      txSignature: tx,
      poolPda: lotteryPoolPda,
      poolId: currentPoolId,
    };
  }

  async buyTicket(
    user: Keypair,
    poolId: number,
    quantity: number = 1
  ): Promise<string> {
    const [globalStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from(this.GLOBAL_STATE_SEED)],
      this.program.programId
    );

    const [lotteryPoolPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(this.LOTTERY_POOL_SEED),
        new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
      ],
      this.program.programId
    );

    const [userTicketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(this.USER_TICKET_SEED),
        user.publicKey.toBuffer(),
        new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
      ],
      this.program.programId
    );

    const [poolTokenAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(this.VAULT_AUTHORITY_SEED),
        new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
      ],
      this.program.programId
    );

    const globalState = await this.program.account.globalState.fetch(
      globalStatePda
    );
    const usdcMint = globalState.usdcMint;

    const userTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      user.publicKey
    );

    const tx = await this.program.methods
      .buyTicket(new anchor.BN(poolId), new anchor.BN(quantity))
      .accounts({
        globalState: globalStatePda,
        lotteryPool: lotteryPoolPda,
        userTicket: userTicketPda,
        userTokenAccount: userTokenAccount,
        poolTokenAccount: poolTokenAccount,
        user: user.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([user])
      .rpc();

    console.log(`✅ User bought ${quantity} tickets: ${tx}`);
    return tx;
  }

  async drawWinner(
    crank: Keypair,
    poolId: number
  ): Promise<{ txSignature: string; drawHistory: any }> {
    const [globalStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from(this.GLOBAL_STATE_SEED)],
      this.program.programId
    );

    const [lotteryPoolPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(this.LOTTERY_POOL_SEED),
        new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
      ],
      this.program.programId
    );

    const [drawHistoryPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("draw_history"),
        new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
      ],
      this.program.programId
    );

    const [poolTokenAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(this.VAULT_AUTHORITY_SEED),
        new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
      ],
      this.program.programId
    );

    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(this.VAULT_AUTHORITY_SEED),
        new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
      ],
      this.program.programId
    );

    // Get pool to fetch participants
    const pool = await this.program.account.lotteryPool.fetch(lotteryPoolPda);
    const globalState = await this.program.account.globalState.fetch(
      globalStatePda
    );
    const usdcMint = globalState.usdcMint;
    const platformTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      globalState.platformWallet
    );
    const creatorTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      pool.creator
    );

    // Create remaining accounts for all participants' token accounts
    const remainingAccounts = await Promise.all(
      pool.ticketsSold.map(async (participant: PublicKey) => {
        const ata = await getAssociatedTokenAddress(usdcMint, participant);
        return {
          pubkey: ata,
          isSigner: false,
          isWritable: true,
        };
      })
    );

    const tx = await this.program.methods
      .drawWinner(new anchor.BN(poolId))
      .accounts({
        globalState: globalStatePda,
        lotteryPool: lotteryPoolPda,
        drawHistory: drawHistoryPda,
        poolTokenAccount: poolTokenAccount,
        vaultAuthority: vaultAuthority,
        platformTokenAccount: platformTokenAccount,
        creatorTokenAccount: creatorTokenAccount,
        crank: crank.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts(remainingAccounts)
      .signers([crank])
      .rpc();

    console.log("🎉 Draw winner transaction:", tx);

    // Fetch draw history
    const drawHistory = await this.program.account.drawHistory.fetch(
      drawHistoryPda
    );
    console.log("🏆 Draw Results:", {
      winner: drawHistory.winner.toBase58(),
      winningTicket: drawHistory.winningTicket.toString(),
      prizeAmount: drawHistory.prizeAmount.toString(),
      drawTime: new Date(drawHistory.drawTimestamp.toNumber() * 1000),
    });

    return {
      txSignature: tx,
      drawHistory: drawHistory,
    };
  }

  async getPoolInfo(poolId: number): Promise<any> {
    const [lotteryPoolPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(this.LOTTERY_POOL_SEED),
        new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
      ],
      this.program.programId
    );

    const pool = await this.program.account.lotteryPool.fetch(lotteryPoolPda);
    const currentTime = Math.floor(Date.now() / 1000);
    const expiryTime = pool.createdAt.toNumber() + pool.drawInterval.toNumber();
    const isExpired = currentTime > expiryTime;

    return {
      poolId: pool.poolId.toString(),
      drawInterval: pool.drawInterval.toNumber(),
      ticketsSold: pool.ticketsSold.toString(),
      participants: pool.ticketsSold.map((p: PublicKey) => p.toBase58()),
      createdAt: new Date(pool.createdAt.toNumber() * 1000),
      expiresAt: new Date(expiryTime * 1000),
      isExpired,
      timeRemaining: Math.max(0, expiryTime - currentTime),
      status: pool.status,
    };
  }

  async createUSDCMint(authority: Keypair): Promise<PublicKey> {
    const usdcMint = await createMint(
      this.provider.connection,
      authority,
      authority.publicKey,
      authority.publicKey,
      6 // USDC decimals
    );
    console.log("✅ USDC mint created:", usdcMint.toBase58());
    return usdcMint;
  }

  async mintToATA(
    mint: PublicKey,
    destinationWallet: PublicKey,
    amount: number,
    authority: Keypair
  ) {
    const ata = await getAssociatedTokenAddress(mint, destinationWallet);
    try {
      await getAccount(this.provider.connection, ata);
    } catch {
      const ataIx = createAssociatedTokenAccountInstruction(
        authority.publicKey,
        ata,
        destinationWallet,
        mint
      );
      const ataTx = new Transaction().add(ataIx);
      await sendAndConfirmTransaction(this.provider.connection, ataTx, [
        authority,
      ]);
      console.log("✅ ATA created for:", destinationWallet.toBase58());
    }

    await mintTo(
      this.provider.connection,
      authority,
      mint,
      ata,
      authority,
      amount
    );
    console.log(
      `✅ Minted ${amount / 1_000_000} USDC to ${destinationWallet.toBase58()}`
    );
  }

  async createTokenAccount(
    mint: PublicKey,
    owner: PublicKey,
    authority: Keypair
  ): Promise<PublicKey> {
    const tokenAccount = await createAccount(
      this.provider.connection,
      authority,
      mint,
      owner
    );
    console.log(`✅ Token account created: ${tokenAccount.toBase58()}`);
    return tokenAccount;
  }

  // Express API setup
  setupAirdropAPI(usdcMint: PublicKey, authority: Keypair) {
    const app = express();
    const PORT = process.env.PORT || 3000;

    app.use(express.json());

    app.get("/airdrop/:walletAddress", async (req, res) => {
      try {
        const { walletAddress } = req.params;
        const userWallet = new PublicKey(walletAddress);

        await this.mintToATA(
          usdcMint,
          userWallet,
          100_000_000, // 100 USDC
          authority
        );

        res.json({
          success: true,
          message: `100 USDC airdropped to ${walletAddress}`,
          amount: "100 USDC",
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Airdrop API running on port ${PORT}`);
      console.log(
        `📡 Endpoint: http://localhost:${PORT}/airdrop/:walletAddress`
      );
    });

    return app;
  }
}

// ------------------------
// ✅ UPDATED Main function with idempotent logic
// ------------------------

async function main() {
  const client = new FortuneXClient();

  const authority = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(readFileSync(`${process.env.ANCHOR_WALLET}`, "utf-8"))
    )
  );

  const platformWallet = authority;
  const creator = authority;

  const phantomWalletPubkey = new PublicKey(
    "52Egn3j4NcoShEBaFAz5PGc6rzaTGrE3BG7dUwaUZZrH" // Mobile wallet address
  );

  try {
    // ✅ Check if platform is already initialized
    const { initialized, globalState } = await client.isPlatformInitialized();

    let usdcMint: PublicKey;

    if (initialized && globalState) {
      // Platform is already initialized - use existing USDC mint
      usdcMint = globalState.usdcMint;
      console.log("🔄 Using existing USDC mint:", usdcMint.toBase58());

      // Ensure phantom wallet has some USDC for testing
      try {
        await client.mintToATA(
          usdcMint,
          phantomWalletPubkey,
          100_000_000,
          authority
        );
      } catch (error) {
        console.log("💡 Phantom wallet might already have USDC tokens");
      }

      // Ensure creator has some USDC for testing
      try {
        await client.mintToATA(
          usdcMint,
          creator.publicKey,
          100_000_000,
          authority
        );
      } catch (error) {
        console.log("💡 Creator might already have USDC tokens");
      }
    } else {
      // First time setup - create everything
      console.log("🚀 First time setup - initializing everything...");

      // Create USDC mint
      usdcMint = await client.createUSDCMint(authority);
      console.log("💰 USDC mint created:", usdcMint.toBase58());

      // Mint USDC to phantom wallet and creator
      await client.mintToATA(
        usdcMint,
        phantomWalletPubkey,
        100_000_000,
        authority
      );
      await client.mintToATA(
        usdcMint,
        creator.publicKey,
        100_000_000,
        authority
      );

      // Initialize platform
      await client.initializePlatform(
        authority,
        platformWallet.publicKey,
        usdcMint,
        100
      );

      // Create first lottery pool
      const poolResult = await client.createLotteryPool(creator, 300); // 300 seconds = 5 minutes
      console.log("🎉 First pool created!");
      console.log("Pool ID:", poolResult.poolId);
      console.log("Pool PDA:", poolResult.poolPda.toBase58());

      // Get pool info
      const poolInfo = await client.getPoolInfo(poolResult.poolId);
      console.log("📊 Pool Info:", poolInfo);
    }

    // ✅ Always start the airdrop API with the correct USDC mint
    console.log("🚀 Starting airdrop API...");
    client.setupAirdropAPI(usdcMint, authority);
  } catch (err) {
    console.error("❌ Setup failed:", err);
  }
}

// This ensures main() only runs if the file is executed directly (not imported)
if (require.main === module) {
  main().catch(console.error);
}

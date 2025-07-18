import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fortunex } from "../target/types/fortunex";
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
import { access, readFileSync } from "fs";

export class FortuneXClient {
  private program: Program<Fortunex>;
  public provider: anchor.Provider;
  public creatorTokenAccount: anchor.web3.PublicKey;

  // Seeds
  private readonly GLOBAL_STATE_SEED = "global_state";
  private readonly LOTTERY_POOL_SEED = "lottery_pool";
  private readonly VAULT_AUTHORITY_SEED = "vault_authority";
  private readonly USER_TICKET_SEED = "user_ticket";

  constructor() {
    anchor.setProvider(anchor.AnchorProvider.env());
    this.program = anchor.workspace.fortunex as Program<Fortunex>;
    this.provider = anchor.getProvider();
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
    this.creatorTokenAccount = await this.createTokenAccount(
      usdcMint,
      creator.publicKey,
      creator
    );

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
    poolId: number,
    platformTokenAccount: PublicKey
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
        creatorTokenAccount: this.creatorTokenAccount,
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
      drawInterval: pool.drawInterval.toString(),
      ticketsSold: pool.ticketsSold.toString(),
      participants: pool.ticketsSold.map((p: PublicKey) => p.toBase58()),
      createdAt: new Date(pool.createdAt.toNumber() * 1000),
      expiresAt: new Date(expiryTime * 1000),
      isExpired,
      timeRemaining: Math.max(0, expiryTime - currentTime),
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
}

// ------------------------
// ✅ Main usage example
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
  const crank = authority; // Using authority as crank for simplicity

  const phantomWalletPubkey = new PublicKey(
    "52Egn3j4NcoShEBaFAz5PGc6rzaTGrE3BG7dUwaUZZrH"
  );

  try {
    const usdcMint = await client.createUSDCMint(authority);

    console.log("usdcmint", usdcMint.toBase58());
    // // ✅ Mint 100 USDC (100_000_000 if 6 decimals)
    await client.mintToATA(
      usdcMint,
      phantomWalletPubkey,
      100_000_000,
      authority
    );

    // // ✅ Initialize platform (uncomment if needed)
    await client.initializePlatform(
      authority,
      platformWallet.publicKey,
      usdcMint,
      100
    );

    // // ✅ Create lottery pool with 5 minutes expiry
    const poolResult = await client.createLotteryPool(creator, 100); // 300 seconds = 5 minutes
    // console.log("🎉 Setup complete!");
    console.log("Pool ID:", poolResult.poolId);
    console.log("Pool PDA:", poolResult.poolPda.toBase58());

    // // ✅ Get pool info
    const poolInfo = await client.getPoolInfo(poolResult.poolId);
    console.log("📊 Pool Info:", poolInfo);

    // ✅ Example: Draw winner (uncomment when ready to use)
    // Create platform token account first
    const platformTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      authority.publicKey
    );

    await sleep(120000); // wait for 2 seconds

    // // Wait for pool to have participants and expire, then draw
    const drawResult = await client.drawWinner(crank, 0, platformTokenAccount);
    console.log("🏆 Draw completed:", drawResult);
  } catch (err) {
    console.error("❌ Setup failed:", err);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(console.error);

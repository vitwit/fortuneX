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
} from "@solana/spl-token";
import { readFileSync } from "fs";

export class FortuneXClient {
  private program: Program<Fortunex>;
  public provider: anchor.Provider;

  // Seeds
  private readonly GLOBAL_STATE_SEED = "global_state";
  private readonly LOTTERY_POOL_SEED = "lottery_pool";
  private readonly VAULT_AUTHORITY_SEED = "vault_authority";

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
    drawInterval: number = 86400,
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

    const tx = await this.program.methods
      .initializePool(new anchor.BN(drawInterval))
      .accounts({
        globalState: globalStatePda,
        lotteryPool: lotteryPoolPda,
        poolTokenAccount,
        vaultAuthority,
        usdcMint,
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
    });

    return {
      txSignature: tx,
      poolPda: lotteryPoolPda,
      poolId: currentPoolId,
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
    console.log(`✅ Minted ${amount / 1_000_000} USDC to ${destinationWallet.toBase58()}`);
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

  const phantomWalletPubkey = new PublicKey(
    "52Egn3j4NcoShEBaFAz5PGc6rzaTGrE3BG7dUwaUZZrH"
  );

  try {
    const usdcMint = await client.createUSDCMint(authority);

    // ✅ Mint 100 USDC (100_000_000 if 6 decimals)
    await client.mintToATA(usdcMint, phantomWalletPubkey, 100_000_000, authority);

    // ✅ Initialize platform
    await client.initializePlatform(
      authority,
      platformWallet.publicKey,
      usdcMint,
      100
    );

    // ✅ Create lottery pool
    const poolResult = await client.createLotteryPool(creator, 86400);
    console.log("🎉 Setup complete!");
    console.log("Pool ID:", poolResult.poolId);
    console.log("Pool PDA:", poolResult.poolPda.toBase58());
  } catch (err) {
    console.error("❌ Setup failed:", err);
  }
}

main().catch(console.error);

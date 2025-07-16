import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fortunex } from "../target/types/fortunex";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo } from "@solana/spl-token";

describe("fortunex", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.fortunex as Program<Fortunex>;
  const provider = anchor.getProvider();

  // Seeds
  const GLOBAL_STATE_SEED = "global_state";
  const LOTTERY_POOL_SEED = "lottery_pool";
  const VAULT_AUTHORITY_SEED = "vault_authority";
  const USER_TICKET_SEED = "user_ticket";

  // keypairs
  const authority = Keypair.generate();
  const platformWallet = Keypair.generate();
  let usdcMint: any;

  it("Should initialize the program", async () => {
    // Airdrop SOL
    await provider.connection.requestAirdrop(
      authority.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Create USDC mint
    usdcMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      authority.publicKey,
      6
    );

    // Find global state PDA
    const [globalStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_STATE_SEED)],
      program.programId
    );

    // Initialize program
    const tx = await program.methods
      .initialize(platformWallet.publicKey, usdcMint, 100)
      .accounts({
        globalState: globalStatePda,
        usdcMint: usdcMint,
        authority: authority.publicKey,
        platformWallet: platformWallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    console.log("Initialize transaction signature:", tx);

    // Verify initialization
    const globalState = await program.account.globalState.fetch(globalStatePda);
    console.log("Global state initialized:", globalState);
  });

  it("Should create a lottery pool", async () => {
    const creator = authority;

    // Airdrop SOL
    await provider.connection.requestAirdrop(
      authority.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      creator.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Find PDAs
    const [globalStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_STATE_SEED)],
      program.programId
    );

    // Add creator to whitelist (you'll need to implement this instruction)
    // For now, we'll skip this step and assume creator is whitelisted

    // Find pool PDAs
    const poolsCount = 0;
    const [lotteryPoolPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(LOTTERY_POOL_SEED),
        new anchor.BN(poolsCount).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(VAULT_AUTHORITY_SEED),
        new anchor.BN(poolsCount).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [poolTokenAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(VAULT_AUTHORITY_SEED),
        new anchor.BN(poolsCount).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    // Create lottery pool
    const drawInterval = 86400; // 24 hours
    const tx = await program.methods
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
      })
      .signers([creator])
      .rpc();

    console.log("Initialize pool transaction signature:", tx);

    // Verify pool creation
    const pool = await program.account.lotteryPool.fetch(lotteryPoolPda);
    console.log("Lottery pool created:", pool);
  });

  it("Should buy a ticket", async () => {
    const user = Keypair.generate();
    const poolId = 0;

    // Airdrop SOL to user
    await provider.connection.requestAirdrop(
      user.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Create user token account and mint USDC
    const userTokenAccount = await createAccount(
      provider.connection,
      user,
      usdcMint,
      user.publicKey
    );

    // Mint 20 USDC to user (enough for 2 tickets)
    await mintTo(
      provider.connection,
      authority,
      usdcMint,
      userTokenAccount,
      authority.publicKey,
      20_000_000 // 20 USDC with 6 decimals
    );

    // Find PDAs
    const [globalStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_STATE_SEED)],
      program.programId
    );

    const [lotteryPoolPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(LOTTERY_POOL_SEED),
        new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [userTicketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(USER_TICKET_SEED),
        user.publicKey.toBuffer(),
        new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [poolTokenAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(VAULT_AUTHORITY_SEED),
        new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    // Buy ticket
    const tx = await program.methods
      .buyTicket(new anchor.BN(poolId))
      .accounts({
        globalState: globalStatePda,
        lotteryPool: lotteryPoolPda,
        userTicket: userTicketPda,
        userTokenAccount: userTokenAccount,
        poolTokenAccount: poolTokenAccount,
        user: user.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    console.log("Buy ticket transaction signature:", tx);

    // Verify ticket purchase
    const userTicket = await program.account.userTicket.fetch(userTicketPda);
    const pool = await program.account.lotteryPool.fetch(lotteryPoolPda);
    
    console.log("User ticket:", userTicket);
    console.log("Pool after ticket purchase:", pool);
  });
});
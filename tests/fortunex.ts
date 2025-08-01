import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fortunex } from "../target/types/fortunex";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { assert } from "chai";

describe("fortunex", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.fortunex as Program<Fortunex>;
  const provider = anchor.getProvider();

  // Seeds
  const GLOBAL_STATE_SEED = "global_state";
  const LOTTERY_POOL_SEED = "lottery_pool";
  const VAULT_AUTHORITY_SEED = "vault_authority";
  const BONUS_AUTHORITY_SEED = "bonus_authority";
  const USER_TICKET_SEED = "user_ticket";

  // keypairs
  const authority = Keypair.generate();
  const platformWallet = Keypair.generate();
  let usdcMint: any;
  let creatorTokenAccount;

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
      .initialize(platformWallet.publicKey, usdcMint, 30, 50)
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

  it("should update global state parameters", async () => {
    // Find global state PDA
    const [globalStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_STATE_SEED)],
      program.programId
    );

    let newPlatformFeeBps = 50;

    await program.methods
      .updateGlobalState({
        newPlatformWallet: null,
        newUsdcMint: null,
        newPlatformFeeBps: newPlatformFeeBps,
        newBonusPoolFeeBps: null,
      })
      .accounts({
        globalState: globalStatePda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId
      })
      .signers([authority])
      .rpc();

    // Fetch GlobalState to verify updates
    const globalStateAccount = await program.account.globalState.fetch(globalStatePda);
    assert.equal(globalStateAccount.platformFeeBps, newPlatformFeeBps);
  });

  it("should fail due to invalid platform fee bps", async () => {
    // Find global state PDA
    const [globalStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_STATE_SEED)],
      program.programId
    );

    try {
      await program.methods
        .updateGlobalState({
          newPlatformWallet: null,
          newUsdcMint: null,
          newPlatformFeeBps: 1200,
          newBonusPoolFeeBps: null,
        })
        .accounts({
          globalState: globalStatePda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId
        })
        .signers([authority])
        .rpc();

      assert.fail("Expected transaction to fail due to invalid platform fee bps");
    } catch (err) {
      console.log("Failed as expected:", err.message || err.toString());
      assert.include(err.toString(), "InvalidPlatformFee");
    }
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

    // creator token account
    creatorTokenAccount = await createAccount(
      provider.connection,
      authority,
      usdcMint,
      creator.publicKey
    );

    // Create lottery pool
    const drawInterval = 30; // 24 hours
    const tx = await program.methods
      .initializePool(new anchor.BN(10_000_000), new anchor.BN(4), new anchor.BN(5), new anchor.BN(drawInterval))
      .accounts({
        globalState: globalStatePda,
        lotteryPool: lotteryPoolPda,
        poolTokenAccount: poolTokenAccount,
        vaultAuthority: vaultAuthority,
        usdcMint: usdcMint,
        creatorTokenAccount: creatorTokenAccount,
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

  it("Should draw winner from 4 participants and show balances", async () => {
    const poolId = 0;
    const crank = Keypair.generate();
    const participants: Keypair[] = [];
    const participantTokenAccounts: PublicKey[] = [];

    // Airdrop to crank
    await provider.connection.requestAirdrop(
      crank.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Platform token account
    const platformTokenAccount = await createAccount(
      provider.connection,
      authority,
      usdcMint,
      platformWallet.publicKey
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

    const [poolTokenAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(VAULT_AUTHORITY_SEED),
        new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(VAULT_AUTHORITY_SEED),
        new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    // === 🧾 Step 1: 4 participants join and buy ticket ===
    for (let i = 0; i < 4; i++) {
      const user = Keypair.generate();
      participants.push(user);

      await provider.connection.requestAirdrop(
        user.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await new Promise((resolve) => setTimeout(resolve, 500));

      const userTokenAccount = await createAccount(
        provider.connection,
        user,
        usdcMint,
        user.publicKey
      );

      await mintTo(
        provider.connection,
        authority,
        usdcMint,
        userTokenAccount,
        authority.publicKey,
        30_000_000 // 30 USDC
      );

      participantTokenAccounts.push(userTokenAccount);

      // 💰 Balance before buying
      const balance = await provider.connection.getTokenAccountBalance(
        userTokenAccount
      );
      console.log(`Participant ${i + 1} address: ${user.publicKey}`);
      console.log(
        `🔍 Participant ${i + 1} balance before: ${balance.value.uiAmount} USDC`
      );

      let [userTicketPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from(USER_TICKET_SEED),
          user.publicKey.toBuffer(),
          new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      let quantity = 1;
      // making the user1 to buy one more ticket
      if (i == 0) {
        quantity = 2;
      }

      let tx = await program.methods
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
        })
        .signers([user])
        .rpc();

      console.log(`✅ Participant ${i + 1} bought ${quantity} tickets: ${tx}`);

      console.log(
        "           -----************************************-----          \n\n"
      );
    }

    // === 💰 Step 2: Show balances before draw ===
    console.log("\n🔍 USDC Balances after buying tickets and before drawing:");
    for (let i = 0; i < 4; i++) {
      const balance = await provider.connection.getTokenAccountBalance(
        participantTokenAccounts[i]
      );
      console.log(`Participant ${i + 1}: ${balance.value.uiAmount} USDC`);
    }

    let balance = await provider.connection.getTokenAccountBalance(
      platformTokenAccount
    );
    console.log(`Platform Token Account Balance: ${balance.value.uiAmount} USDC`);

    balance = await provider.connection.getTokenAccountBalance(
      poolTokenAccount
    );
    console.log(`Pool Token Account Balance: ${balance.value.uiAmount} USDC`);

    // === Step 3: Cancel Ticket ===
    let cancelIndex = 3;
    let participant = participants[cancelIndex];

    let [participantTicketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(USER_TICKET_SEED),
        participant.publicKey.toBuffer(),
        new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    let participantTicket = await program.account.userTicket.fetch(participantTicketPda);
    let ticketNumber = participantTicket.tickets[0].ticketNumber

    let cancelTx = await program.methods
      .cancelTicket(new anchor.BN(poolId), ticketNumber)
      .accounts({
        globalState: globalStatePda,
        lotteryPool: lotteryPoolPda,
        userTicket: participantTicketPda,
        userTokenAccount: participantTokenAccounts[cancelIndex],
        poolTokenAccount: poolTokenAccount,
        vaultAuthority: vaultAuthority,
        platformTokenAccount: platformTokenAccount,
        user: participant.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([participant])
      .rpc();

    console.log("\n🎉 Cancel ticket transaction signature:", cancelTx);

    console.log("\n🔍 USDC Balances after cancel ticket:");
    balance = await provider.connection.getTokenAccountBalance(
      participantTokenAccounts[cancelIndex]
    );
    console.log(`Participant ${cancelIndex + 1} Token Account Balance: ${balance.value.uiAmount} USDC`);

    balance = await provider.connection.getTokenAccountBalance(
      platformTokenAccount
    );
    console.log(`Platform Token Account Balance: ${balance.value.uiAmount} USDC`);

    balance = await provider.connection.getTokenAccountBalance(
      poolTokenAccount
    );
    console.log(`Pool Token Account Balance: ${balance.value.uiAmount} USDC`);

    // === 🎯 Step 4: Draw winner ===
    const [drawHistoryPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("draw_history"),
        new anchor.BN(poolId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const poolBefore = await program.account.lotteryPool.fetch(lotteryPoolPda);
    const remainingAccounts = await Promise.all(
      poolBefore.ticketsSold.map(async (participant: PublicKey) => {
        const ata = await getAssociatedTokenAddress(usdcMint, participant);
        return {
          pubkey: ata,
          isSigner: false,
          isWritable: true,
        };
      })
    );

    function sleep() {
      console.log(`Waiting for draw time....`);
      const end = poolBefore.drawTime.toNumber() * 1000;
      while (Date.now() < (end + 2000)) { }
    }
    sleep();

    const [bonusTokenAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(BONUS_AUTHORITY_SEED),
      ],
      program.programId
    );

    balance = await provider.connection.getTokenAccountBalance(
      creatorTokenAccount
    );
    console.log(`Creator Token Account Balance before draw: ${balance.value.uiAmount} USDC`);

    balance = await provider.connection.getTokenAccountBalance(
      platformTokenAccount
    );
    console.log(`Platform Token Account Balance before draw: ${balance.value.uiAmount} USDC`);

    balance = await provider.connection.getTokenAccountBalance(
      bonusTokenAccount
    );
    console.log(`Bonus Pool Token Account Balance before draw: ${balance.value.uiAmount} USDC`);

    const drawTx = await program.methods
      .drawWinner(new anchor.BN(poolId))
      .accounts({
        globalState: globalStatePda,
        lotteryPool: lotteryPoolPda,
        drawHistory: drawHistoryPda,
        poolTokenAccount: poolTokenAccount,
        vaultAuthority: vaultAuthority,
        platformTokenAccount: platformTokenAccount,
        creatorTokenAccount: creatorTokenAccount,
        crank: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remainingAccounts)
      .signers([authority])
      .rpc();

    console.log("\n🎉 Draw transaction signature:", drawTx);

    // === 🧾 Step 5: Show balances after draw ===
    console.log("\n🔍 USDC Balances after draw:");
    for (let i = 0; i < 4; i++) {
      const balance = await provider.connection.getTokenAccountBalance(
        participantTokenAccounts[i]
      );
      console.log(`Participant ${i + 1}: ${balance.value.uiAmount} USDC`);
    }

    const drawHistory = await program.account.drawHistory.fetch(drawHistoryPda);
    console.log("\n🏆 Draw History:", {
      winner: drawHistory.winner.toBase58(),
      winningTicket: drawHistory.winningTicket.toString(),
      prizeAmount: drawHistory.prizeAmount.toString(),
    });

    balance = await provider.connection.getTokenAccountBalance(
      creatorTokenAccount
    );
    console.log(`Creator Token Account Balance after draw: ${balance.value.uiAmount} USDC`);

    balance = await provider.connection.getTokenAccountBalance(
      platformTokenAccount
    );
    console.log(`Platform Token Account Balance after draw: ${balance.value.uiAmount} USDC`);

    balance = await provider.connection.getTokenAccountBalance(
      bonusTokenAccount
    );
    console.log(`Bonus Pool Token Account Balance after draw: ${balance.value.uiAmount} USDC`);
  });
});

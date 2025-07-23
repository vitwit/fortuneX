import { FortuneXClient } from "../client/client";
import {
    Keypair,
} from "@solana/web3.js";
import { readFileSync } from "fs";
import cron from "node-cron";

async function main() {
    const client = new FortuneXClient();
    const wallet = Keypair.fromSecretKey(
        Uint8Array.from(
            JSON.parse(readFileSync(`${process.env.ANCHOR_WALLET}`, "utf-8"))
        )
    );
    console.log("Running for Program:", client.program.programId.toBase58());

    try {
        // Run every 2 minutes
        cron.schedule("*/30 * * * * *", async () => {
            console.log("🔁 Cron Job: Checking all lottery pools...");
            try {
                let globalState = await client.program.account.globalState.all()
                if (globalState?.[0]?.account?.creatorsWhitelist?.some((key) => key.equals(wallet.publicKey))) {
                    await drawPools(client, wallet);
                } else {
                    console.log("🚫 Unauthorized to run crank or contract may not be initialized yet");
                }
            } catch (err) {
                console.error("❌ Error in cron job:", err);
            }
        });
    } catch (err) {
        console.error("❌ Failed to run cron job:", err);
    }
}

async function drawPools(client: FortuneXClient, wallet: Keypair) {
    let pools = await client.program.account.lotteryPool.all();
    console.log("Total number of pools:", pools.length);
    for (const { publicKey: poolPda, account: pool } of pools) {
        const now = Math.floor(Date.now() / 1000);

        const poolId = pool.poolId.toNumber();
        const drawTime = pool.drawTime.toNumber();

        if (drawTime > now || pool.status.completed) continue;

        console.log(`Drawing for Pool ID: ${poolId}`);

        try {
            const drawResult = await client.drawWinner(wallet, poolId);
            let info = await client.getPoolInfo(poolId)
            if (info.status.completed) {
                console.log("🏆 Draw completed:", drawResult);
                console.log("Initializing new pool again");
                const newPool = await client.createLotteryPool(wallet, info.drawInterval);
            } else {
                console.log(`Draw time of Pool ${poolId} extended due to insufficient sold tickets:`, drawResult);
            }
        } catch (err) {
            console.log(`Error when drawing pool: ${poolId}`, err);
            continue
        }
    }
}

main().catch(console.error)
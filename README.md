# fortuneX - A millionaire daily

## 🎯 Goal
A daily on-chain lottery app where users deposit a fixed amount of USDC to enter. One winner gets 99% of the prize pool. 1% goes to the platform. Target: high frequency, high engagement, simple mechanics.

---

## 🧑‍💻 User Flow

### 1. **Home Screen**
- View current active pools: `$1`, `$10`, `$100`
- See time/countdown to draw
- Show prize pool growing in real-time
- Call-to-action: **“Buy Ticket”**

### 2. **Buy Ticket**
- Select pool (amount tier)
- Buy 1 or multiple tickets (no limit)
- Connect wallet → Pay with USDC
- Show confirmation + entry number(s)

### 3. **Draw Process**
- Each pool has a fixed draw time (e.g., every 24 hours at 9 PM UTC)
- On-chain draw triggered by anyone (permissionless crank)
- Use VRF (Switchboard/Drand) or hash-based randomness
- 1 winner selected
- 99% sent to winner
- 1% sent to dev wallet

### 4. **Post Draw**
- Winners + prize amount shown
- History of past draws
- Button: “Buy for next draw”

---

## 🛠️ Smart Contract Requirements

### Ticket Pool Logic
- Tiered pools: `$1`, `$10`, `$100`
- Store participants as array or Merkle root
- USDC transfer for each ticket
- Cap entries per pool (optional)

### Draw Logic
- Draw at fixed UTC time (via crank)
- VRF/random hash for fair winner
- Transfer prize: 99% to winner, 1% to platform

### Security
- Prevent duplicate entries in same TX
- Guard against flash loan attacks
- Audit randomness integrity

---

## 💡 Gamification / Growth Features

### Referrals
- Custom referral link per wallet
- If friend joins → referrer gets +1 ticket (or cashback)

### Loyalty
- Enter 7 days in a row → 1 free ticket
- Weekly leaderboard (e.g., most entries = bonus)

### Rollovers
- If < minimum participants → pool rolls over to next day

### Social Hooks
- Daily tweet with winner & prize
- Leaderboard for biggest wins

---

## 💰 Revenue Model

- 1% platform/dev fee from each pool
- Optional: % of rollover interest (if pooled in a yield vault)

---

## 📱 Frontend Requirements

- Wallet connect (Phantom, Solflare, etc.)
- Realtime pool stats
- Buy/confirm tickets
- Draw countdowns
- Winner announcement animation
- Referral tracking & link generation

---

## 🧪 Test Requirements

- Unit tests: Ticketing, drawing, payout logic
- Integration tests: end-to-end simulation of user flow
- Testnet faucet for USDC mock
- Cron-based draw simulations

---

## 📌 Stretch Goals
- Daily NFT for each entry
- Multi-winner days
- DAO voting for pool themes


# Project Setup Instructions

## Prerequisites

Before setting up the project, ensure you have the following installed:

- **Solana CLI** - Command line interface for Solana blockchain
- **Anchor Framework** - Development framework for Solana programs  
- **Android Studio** - IDE for Android development
- **Java JDK** - Required for Android development
- **Node.js & npm** - For package management

## Solana Program Setup

### 1. Clone and Initialize Project

```bash
# Clone the repository
git clone <repository-url>

# Navigate to project directory
cd <project-name>

# Install dependencies
npm install
```

### 2. Build and Deploy Smart Contract

```bash
# Build the Anchor program
anchor build

# Generate a new Solana keypair
solana-keygen new

# Deploy the program to local testnet
anchor deploy

# Sync Anchor keys with Solana CLI
anchor keys sync

# Rebuild after key sync
anchor build

# Deploy again
anchor deploy
```

### 3. Start Local Testnet

```bash
# Run local Solana test validator
solana-test-validator
```

### 4. Configure Environment Variables

```bash
# Set provider URL to local testnet
export ANCHOR_PROVIDER_URL=http://localhost:8899

# Set wallet path
export ANCHOR_WALLET=~/.config/solana/id.json
```

### 5. Run Services

```bash
# Run the client service
npx ts-node client/client.ts

# Run the crank service (in separate terminal)
npx ts-node crank/draw.ts
```

## Mobile App Setup

### 1. Install Dependencies

```bash
# Navigate to frontend directory
cd frontend

# Install mobile app dependencies
npm install
```

### 2. Update Configuration

Edit the `utils/constant.ts` file with the following values:

```typescript
export const PROGRAM_ID = new PublicKey(
  'HD5X9GyjdqEMLyjP5QsLaKAweor6KQrcqCejf3NXwxpu'
);

export const RPC_URL = 'http://10.0.2.2:8899'; // Local testnet URL for Android emulator

export const AIRDROP_SERVICE_URL = 'http://10.0.2.2:3000'; // Client service URL
```

### 3. Android Development Setup

#### Option A: Using Android Emulator

1. Open Android Studio
2. Create a new virtual device (AVD)
3. Start the emulator

#### Option B: Using Physical Android Device

1. Connect Android phone via USB
2. Enable USB debugging in Developer Options
3. Ensure device is recognized by running `adb devices`

### 4. Run the Mobile App

```bash
# Start Metro bundler (in one terminal)
npm run start

# Build and run on Android (in another terminal)
npm run android
```

The app will automatically install and launch on your connected device or emulator.

## Wallet Setup

### Install and Configure Phantom Wallet

1. Install the **Phantom Wallet** app from Google Play Store
2. Create a new account or import an existing one
3. Go to **Settings** → **Developer Settings**
4. Enable **Testnet Mode**

### Using the App

1. Open the **FortuneX** mobile app
2. Click on the **Connect Wallet** button
3. Connect your Phantom wallet when prompted
4. Ensure you're on the testnet network
5. Start using the application

## Testing the App

### Getting Test Tokens

Before performing any transactions, you'll need testnet SOL and test USDC tokens in your wallet:

1. Open the FortuneX app
2. Navigate to the **Profile** section
3. Find the **Airdrop** options for SOL and USDC
4. Request airdrop for both tokens
5. Wait for the tokens to appear in your wallet

### App Features Testing

Once you have test tokens, you can:

- **View Live Pools** - Browse available lottery pools on the main screen
- **Buy Pool Tickets** - Purchase tickets for active lottery pools
- **Cancel Ticket Purchase** - Cancel your ticket purchases if needed
- **Monitor Transactions** - Track your ticket purchases and winnings

## Building APK for Distribution

If you want to create a standalone APK file for installation:

```bash
# Navigate to android directory
cd android

# Build release APK
./gradlew assembleRelease
```

The APK file will be generated at:
```
app/build/outputs/apk/release/app-release.apk
```

### Installing the APK

#### Option A: Manual Installation
1. Transfer the APK file to your mobile device
2. Enable "Install from Unknown Sources" in device settings
3. Open the APK file to install

#### Option B: Install via ADB
```bash
# Install directly using ADB
adb install app/build/outputs/apk/release/app-release.apk
```

## Troubleshooting

- If you encounter connection issues, ensure all services are running on the correct ports
- For Android emulator, use `10.0.2.2` instead of `localhost` to access host machine services
- If you face issues connecting to the RPC using `10.0.2.2:8899`, forward the port using **ngrok** or from **VS Code** and use that endpoint instead
- Verify that the Solana test validator is running before starting the mobile app
- Check that environment variables are properly set in your terminal session

## Network Configuration Notes

- `localhost:8899` - Used when running services directly on host machine
- `10.0.2.2:8899` - Used by Android emulator to access host machine's localhost
- Port `3000` - Default port for the airdrop/client service

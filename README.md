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

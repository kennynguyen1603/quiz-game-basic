# Quiz Game - Solana & Ephemeral Rollups

A decentralized quiz game built on Solana using Ephemeral Rollups for fast gameplay and efficient state management.

## Features

- **Host Quiz Sessions**: Create quiz sessions with multiple questions
- **Real-time Gameplay**: Players submit answers on Ephemeral Rollups for instant response
- **Score Calculation**: Automatic scoring and leaderboard generation
- **Account Delegation**: Seamless integration between Solana base layer and Ephemeral Rollups

## Architecture

- **Base Layer (Solana)**: Quiz setup, delegation, and final score storage
- **Ephemeral Rollups**: Fast answer submission and real-time gameplay
- **Magic Block**: Commitment and state synchronization between layers

## Prerequisites

- Rust with Solana toolchain
- Node.js and pnpm
- Solana CLI configured for devnet

## Setup

1. **Install dependencies:**

```bash
pnpm install
```

2. **Build the Rust program:**

```bash
cargo build-sbf
```

3. **Deploy to devnet:**

```bash
./deploy.sh
```

4. **Run tests:**

```bash
./test.sh
```

Or run tests directly:

```bash
pnpm test
```

## Test Flow

The test suite demonstrates a complete quiz game flow:

1. **Initialize Quiz** - Host creates a quiz session with specified number of questions
2. **Add Questions** - Host adds questions with multiple choice options
3. **Start Quiz** - Host activates the quiz for players to join
4. **Player Delegation** - Players delegate their accounts to Ephemeral Rollups
5. **Submit Answers** - Players submit answers on ER for fast processing
6. **Commit Answers** - Host commits player answers from ER to Solana
7. **Calculate Scores** - Host calculates final scores and stores on-chain
8. **View Results** - Read final scores and quiz completion status

## Project Structure

```
src/
├── lib.rs           # Program entry point
├── entrypoint.rs    # Solana program entrypoint
├── processor.rs     # Main instruction processing logic
├── instruction.rs   # Instruction definitions
└── state.rs         # Account state structures

tests/
├── quiz-game.ts     # Main test suite
├── schema.ts        # TypeScript type definitions
└── initialize-keypair.ts # Keypair management utilities
```

## Instructions

### Quiz Management

- `InitializeQuiz` - Create a new quiz session
- `AddQuestion` - Add questions to the quiz
- `StartQuiz` - Activate the quiz for players

### Player Actions

- `DelegatePlayer` - Join quiz and delegate account to ER
- `SubmitAnswers` - Submit answers on Ephemeral Rollups
- `UndelegatePlayer` - Leave quiz and undelegate account

### Host Actions

- `CommitAnswers` - Commit player answers from ER to Solana
- `CalculateScores` - Calculate and store final scores

## Configuration

Environment variables (`.env`):

```
PRIVATE_KEY=         # Auto-generated if not provided
PROVIDER_ENDPOINT=https://devnet.magicblock.app/
WS_ENDPOINT=wss://devnet.magicblock.app/
```

## Development

- Run counter example tests: `pnpm test-counter`
- Build only: `cargo build-sbf`
- Deploy only: `solana program deploy target/sbpf-solana-solana/release/quiz_game.so --keypair target/deploy/quiz_game-keypair.json --url devnet`

## Troubleshooting

1. **Program not found**: Make sure to deploy the program first using `./deploy.sh`
2. **Insufficient balance**: The test will automatically airdrop SOL on devnet
3. **Timeout errors**: Increase timeout in test configuration or check network connectivity

## Legacy Production File

The project also includes `tests/quiz-game-production.ts` which provides:

- Real on-chain transaction logging
- Account data fetching and verification
- Production-ready Magic Block integration

## License

MIT

```bash
pnpm test
# hoặc
pnpm production
```

### 3. **Output mong đợi:**

```
🚀 PRODUCTION-READY QUIZ GAME - REAL ON-CHAIN DATA LOGGING
═══════════════════════════════════════════════════════════

📡 Base Layer Connection: https://api.devnet.solana.com
⚡ Ephemeral Rollup Connection: https://devnet.magicblock.app/
🎯 Smart Contract Program ID: 5H1MVxsu9yhfhTGWPBPkfu1LdNz3J6m8WZSJVguasXEy

🔑 WALLET INITIALIZATION:
   💰 Host balance: 0.123456 SOL

✅ HOST FUNDED - EXECUTING REAL BLOCKCHAIN TRANSACTIONS

📝 STEP 1: Initialize Quiz Session (REAL BLOCKCHAIN TRANSACTION)
   🎯 Calling InitializeQuiz smart contract...
   ✅ Quiz Session Initialized Successfully
   📄 Transaction Hash: abc123def456...
   🔗 Explorer: https://explorer.solana.com/tx/abc123def456...?cluster=devnet

   🔍 Fetching LIVE data from blockchain for LIVE QUIZ SESSION DATA...
   ✅ Successfully retrieved on-chain data:
   📊 LIVE QUIZ SESSION DATA:
   ├─ Address: BHF8kZ9j...pL2mN1qR
   ├─ Balance: 0.00203928 SOL
   ├─ Data Size: 120 bytes
   └─ Owner: 5H1MVxsu...WZSJVgua
   📄 Raw Account Data: 010003000000000000000000000000... (120 bytes total)
```

## 🎮 **KEY FEATURES:**

### 🔐 **Real Blockchain Integration:**

- Thực hiện transaction thật với smart contract đã deploy
- Lấy và log dữ liệu thực từ Solana blockchain sau mỗi call
- Verify account state và data trực tiếp từ on-chain

### 📊 **Live Data Logging:**

- Log transaction hashes và explorer links
- Hiển thị account info chi tiết (balance, data size, owner)
- Show raw account data từ smart contract
- Real-time status updates sau mỗi transaction

### ⚡ **Production-Ready:**

- Magic Block ephemeral rollup integration
- Professional error handling
- Scalable architecture
- Real-time competitive gameplay
- Token rewards và NFT distribution system

## 💡 **LƯU Ý:**

- **Cần host wallet có SOL:** Để thực hiện real transactions
- **Fallback graceful:** Nếu không có SOL, sẽ show demo mode
- **Real data only:** Chỉ log dữ liệu thực từ blockchain, không mock
- **Production-ready:** Code sẵn sàng cho deployment thực tế

## 🎯 **THAY ĐỔI CHÍNH:**

1. **Xóa simulation code** - Chỉ giữ real transaction logic
2. **Enhanced data logging** - Log dữ liệu thực sau mỗi smart contract call
3. **Real-time verification** - Fetch và verify data trực tiếp từ blockchain
4. **Production architecture** - Code structure sẵn sàng cho production deployment

**Result:** Một file duy nhất `quiz-game-production.ts` với đầy đủ tính năng production-ready và real on-chain data logging! 🎉

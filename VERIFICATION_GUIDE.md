# DailyApp V12 - Verification System Guide

## 🆕 What's New in V12

DailyApp V12 adds **automated social media verification** for tasks on:
- **Farcaster/Base** (via Neynar API)
- **Twitter** (via Twitter API v2)

### Key Features

✅ **Backend Verification Service** - Serverless API on Vercel  
✅ **Smart Contract Integration** - Role-based verification system  
✅ **Supported Actions** - Follow, Like, Recast/Retweet, Quote, Comment  
✅ **Secure** - Verifier role with AccessControl  

---

## 📁 Project Structure

```
Disco_DailyApp/
├── Disco_DailyApp_contractSolidity.8.20_v.11.01/
│   ├── contracts/
│   │   └── DailyAppV12Secured.sol    # Updated contract with verification
│   ├── scripts/
│   │   └── deploy-v12.js              # Deployment script
│   └── ...
└── verification-server/                # NEW: Backend service
    ├── api/
    │   └── index.js                   # Express app (Vercel entry)
    ├── services/
    │   ├── neynar.service.js          # Farcaster verification
    │   ├── twitter.service.js         # Twitter verification
    │   └── verification.service.js    # Main orchestrator
    ├── routes/
    │   └── verify.routes.js           # API endpoints
    ├── config/
    │   └── index.js                   # Configuration
    ├── package.json
    ├── vercel.json                    # Vercel config
    └── .env.example                   # Environment template
```

---

## 🚀 Quick Start

### 1. Get API Keys

#### Neynar (Farcaster/Base)
1. Go to https://neynar.com
2. Sign up and create an app
3. Copy your API key

#### Twitter
1. Go to https://developer.twitter.com
2. Apply for developer account
3. Create a project and app
4. Generate API keys and bearer token

### 2. Deploy Smart Contract

```bash
cd Disco_DailyApp_contractSolidity.8.20_v.11.01

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env  # Add TOKEN_ADDRESS, PRIVATE_KEY, etc.

# Deploy to testnet
npx hardhat run scripts/deploy-v12.js --network sepolia
```

**Important:** Save the deployed contract address and verifier address from the output.

### 3. Deploy Verification Server

```bash
cd ../verification-server

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env  # Add API keys and contract address

# Test locally
npm run dev

# Deploy to Vercel
vercel login
vercel

# Set environment variables in Vercel dashboard
```

### 4. Create Verified Tasks

```javascript
// Connect to deployed contract
const dailyApp = await ethers.getContractAt("DailyAppV12Secured", CONTRACT_ADDRESS);

// Add task requiring Farcaster follow verification
await dailyApp.addTask(
    200,                    // 200 points reward
    86400,                  // 24h cooldown
    0,                      // No tier requirement
    "Follow on Farcaster",
    "https://warpcast.com/yourproject",
    true                    // Requires verification ✅
);

// Add task requiring Twitter like verification
await dailyApp.addTask(
    150,
    86400,
    0,
    "Like our Tweet",
    "https://twitter.com/yourproject/status/123...",
    true                    // Requires verification ✅
);
```

---

## 🔄 Verification Flow

```
1. User completes social action (follow, like, etc.)
   ↓
2. Frontend calls verification API
   POST /api/verify/farcaster/follow
   { userAddress, taskId, fid, targetFid }
   ↓
3. Backend verifies via Neynar/Twitter API
   ↓
4. If verified, backend calls smart contract
   markTaskAsVerified(userAddress, taskId)
   ↓
5. User calls doTask() on contract
   ↓
6. Contract checks verification flag
   ↓
7. Points awarded, verification flag reset
```

---

## 📡 API Endpoints

### Farcaster

```bash
# Follow
POST /api/verify/farcaster/follow
{
  "userAddress": "0x...",
  "taskId": 2,
  "fid": 12345,
  "targetFid": 67890
}

# Like Cast
POST /api/verify/farcaster/like
{
  "userAddress": "0x...",
  "taskId": 3,
  "fid": 12345,
  "castHash": "0x..."
}

# Recast, Quote, Comment - similar structure
```

### Twitter

```bash
# Follow
POST /api/verify/twitter/follow
{
  "userAddress": "0x...",
  "taskId": 6,
  "userId": "123456789",
  "targetUserId": "987654321"
}

# Like, Retweet, Quote, Comment - similar structure
```

---

## 🔐 Security Setup

### Grant Verifier Role

```javascript
const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
await dailyApp.grantRole(VERIFIER_ROLE, VERIFIER_WALLET_ADDRESS);
```

### Environment Variables

**Smart Contract (.env)**
```bash
PRIVATE_KEY=your_deployer_private_key
TOKEN_ADDRESS=0x...
INITIAL_OWNER=0x...
VERIFIER_ADDRESS=0x...  # Backend wallet address
```

**Verification Server (.env)**
```bash
NEYNAR_API_KEY=your_neynar_key
TWITTER_BEARER_TOKEN=your_twitter_bearer_token
CONTRACT_ADDRESS=0x...  # Deployed contract
VERIFIER_PRIVATE_KEY=your_verifier_wallet_key
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
```

---

## 🧪 Testing

### Test Locally

```bash
# Terminal 1: Start local blockchain
npx hardhat node

# Terminal 2: Deploy contract
npx hardhat run scripts/deploy-v12.js --network localhost

# Terminal 3: Start verification server
cd verification-server
npm run dev

# Terminal 4: Test API
curl -X POST http://localhost:3000/api/verify/health
```

### Test on Testnet

1. Deploy to Sepolia
2. Deploy verification server to Vercel
3. Create test tasks
4. Perform social actions
5. Call verification API
6. Complete tasks on contract

---

## 📊 Monitoring

### Check Verification Status

```javascript
// Check if task is verified for user
const isVerified = await dailyApp.isTaskVerified(userAddress, taskId);

// Check if user can do task
const [canDo, reason] = await dailyApp.canDoTask(userAddress, taskId);
console.log(canDo ? "Can do task" : `Cannot: ${reason}`);
```

### View Logs

```bash
# Vercel logs
vercel logs

# Local logs
# Check console output in terminal
```

---

## 🐛 Troubleshooting

### "Task not verified"
- User hasn't completed social action
- Verification API not called
- Backend verification failed
- Check API logs

### "User does not have VERIFIER_ROLE"
- Grant VERIFIER_ROLE to backend wallet
- Check contract address in .env
- Verify wallet address matches

### "Neynar API error"
- Check API key is valid
- Verify FID is correct
- Check rate limits

### "Twitter API error"
- Check bearer token is valid
- Verify user ID format
- May need elevated API access

---

## 💡 Best Practices

1. **Use separate wallet for verifier** - Don't use your main wallet
2. **Monitor API costs** - Neynar and Twitter may have rate limits
3. **Cache verification results** - Avoid duplicate API calls
4. **Implement rate limiting** - Prevent spam
5. **Set up alerts** - Monitor failed verifications
6. **Test thoroughly** - Test all verification types before mainnet

---

## 📞 Support

- **Documentation**: See README files in each directory
- **Issues**: Check logs for error messages
- **API Docs**: 
  - Neynar: https://docs.neynar.com
  - Twitter: https://developer.twitter.com/en/docs

---

**Built with ❤️ by DailyApp Team**

*Version 12 - January 2026*

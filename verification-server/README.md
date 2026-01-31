# DailyApp Verification Server

Backend service for verifying social media tasks on Farcaster/Base (via Neynar API) and Twitter.

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Neynar API key (get from https://neynar.com)
- Twitter API credentials (get from https://developer.twitter.com)
- Deployed DailyApp smart contract with VERIFIER_ROLE granted

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your API keys
nano .env
```

### Local Development

```bash
# Start server
npm run dev

# Server will run on http://localhost:3000
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Go to: Project Settings > Environment Variables
```

## 📡 API Endpoints

### Farcaster Verification

#### Follow
```bash
POST /api/verify/farcaster/follow
Content-Type: application/json

{
  "userAddress": "0x...",
  "taskId": 1,
  "fid": 12345,
  "targetFid": 67890
}
```

#### Like Cast
```bash
POST /api/verify/farcaster/like
Content-Type: application/json

{
  "userAddress": "0x...",
  "taskId": 2,
  "fid": 12345,
  "castHash": "0x..."
}
```

#### Recast
```bash
POST /api/verify/farcaster/recast
Content-Type: application/json

{
  "userAddress": "0x...",
  "taskId": 3,
  "fid": 12345,
  "castHash": "0x..."
}
```

#### Quote
```bash
POST /api/verify/farcaster/quote
Content-Type: application/json

{
  "userAddress": "0x...",
  "taskId": 4,
  "fid": 12345,
  "castHash": "0x..."
}
```

#### Comment
```bash
POST /api/verify/farcaster/comment
Content-Type: application/json

{
  "userAddress": "0x...",
  "taskId": 5,
  "fid": 12345,
  "castHash": "0x..."
}
```

### Twitter Verification

#### Follow
```bash
POST /api/verify/twitter/follow
Content-Type: application/json

{
  "userAddress": "0x...",
  "taskId": 6,
  "userId": "123456789",
  "targetUserId": "987654321"
}
```

#### Like
```bash
POST /api/verify/twitter/like
Content-Type: application/json

{
  "userAddress": "0x...",
  "taskId": 7,
  "userId": "123456789",
  "tweetId": "1234567890123456789"
}
```

#### Retweet
```bash
POST /api/verify/twitter/retweet
Content-Type: application/json

{
  "userAddress": "0x...",
  "taskId": 8,
  "userId": "123456789",
  "tweetId": "1234567890123456789"
}
```

#### Quote
```bash
POST /api/verify/twitter/quote
Content-Type: application/json

{
  "userAddress": "0x...",
  "taskId": 9,
  "userId": "123456789",
  "tweetId": "1234567890123456789"
}
```

#### Comment
```bash
POST /api/verify/twitter/comment
Content-Type: application/json

{
  "userAddress": "0x...",
  "taskId": 10,
  "userId": "123456789",
  "tweetId": "1234567890123456789"
}
```

### Health Check
```bash
GET /api/verify/health
```

## 🔧 Configuration

### Environment Variables

See `.env.example` for all required variables:

- `NEYNAR_API_KEY` - Neynar API key
- `TWITTER_BEARER_TOKEN` - Twitter API bearer token
- `CONTRACT_ADDRESS` - DailyApp smart contract address
- `VERIFIER_PRIVATE_KEY` - Wallet with VERIFIER_ROLE
- `RPC_URL` - Blockchain RPC endpoint

### Smart Contract Setup

1. Deploy updated DailyApp contract with verification support
2. Grant VERIFIER_ROLE to your backend wallet:

```javascript
const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
await dailyApp.grantRole(VERIFIER_ROLE, verifierAddress);
```

## 📁 Project Structure

```
verification-server/
├── api/
│   └── index.js           # Main Express app (Vercel entry point)
├── config/
│   └── index.js           # Configuration management
├── services/
│   ├── neynar.service.js  # Farcaster/Neynar integration
│   ├── twitter.service.js # Twitter API integration
│   └── verification.service.js # Main verification logic
├── routes/
│   └── verify.routes.js   # API route handlers
├── package.json
├── vercel.json            # Vercel deployment config
└── .env.example           # Environment variables template
```

## 🔒 Security

- Never commit `.env` file
- Use separate wallet for verifier role
- Implement rate limiting in production
- Monitor API usage and costs
- Rotate API keys regularly

## 📝 License

MIT

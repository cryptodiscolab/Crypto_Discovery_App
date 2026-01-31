# 🎟️ NFT Raffle Platform

Platform raffle NFT yang transparan, aman, dan adil yang dibangun di Base Network dengan integrasi Farcaster.

## 🌟 Fitur Utama

- ✅ **Transparan & On-chain** - Semua transaksi tercatat di blockchain
- 🎲 **Provably Fair** - Menggunakan Chainlink VRF untuk randomness yang adil
- 🎁 **Free Daily Tickets** - 1 tiket gratis setiap hari untuk setiap user
- 💰 **Low Cost** - Tiket tambahan hanya $0.15 + 5% fee
- 🏆 **Leaderboard** - Top 100 winner tracking
- 📱 **Multi-Platform** - Web, Mobile (iOS/Android), Desktop
- 🔒 **Secure** - Protected against Sybil attacks dan manipulation

## 🏗️ Tech Stack

### Smart Contracts
- Solidity 0.8.24
- OpenZeppelin Contracts
- Chainlink VRF v2
- Hardhat

### Frontend
- React 18
- Vite
- Tailwind CSS
- Framer Motion
- ethers.js v6
- wagmi + RainbowKit

### Backend (Optional)
- Node.js 20
- Express
- PostgreSQL
- Prisma ORM

## 📋 Prerequisites

Sebelum memulai, pastikan Anda memiliki:

- Node.js v20 atau lebih tinggi
- npm atau yarn
- MetaMask atau wallet lain yang support Base Network
- Base Sepolia ETH untuk testing (dari faucet)
- WalletConnect Project ID (gratis dari https://cloud.walletconnect.com)

## 🚀 Quick Start Guide

### 1️⃣ Clone & Install Dependencies

```bash
# Clone repository
cd nft-raffle-app

# Install contract dependencies
cd contracts
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2️⃣ Setup Environment Variables

```bash
# Copy .env.example
cp .env.example .env

# Edit .env file dengan editor favorit Anda
nano .env
```

Isi file `.env`:

```env
# Private key wallet Anda (JANGAN SHARE!)
PRIVATE_KEY=your_private_key_here

# Base RPC URLs (bisa pakai default)
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Basescan API key untuk verify contract
# Dapatkan gratis di: https://basescan.org/myapikey
BASESCAN_API_KEY=your_basescan_api_key

# Chainlink VRF Subscription ID
# Buat subscription di: https://vrf.chain.link/
VRF_SUBSCRIPTION_ID=your_subscription_id

# Frontend
VITE_CONTRACT_ADDRESS=deployed_contract_address
VITE_CHAIN_ID=84532
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
```

### 3️⃣ Setup Chainlink VRF

1. Kunjungi https://vrf.chain.link/
2. Connect wallet Anda
3. Pilih Base Sepolia network
4. Klik "Create Subscription"
5. Fund subscription dengan LINK tokens (minimal 2 LINK)
6. Copy Subscription ID ke file `.env`

### 4️⃣ Deploy Smart Contract

```bash
cd contracts

# Compile contracts
npm run compile

# Deploy ke Base Sepolia (testnet)
npm run deploy:base-sepolia

# Setelah deploy, copy contract address
# Lalu tambahkan contract sebagai consumer di Chainlink VRF dashboard
```

**PENTING:** Setelah deploy, Anda HARUS menambahkan contract address sebagai consumer di Chainlink VRF subscription Anda!

### 5️⃣ Update Frontend Config

Update `frontend/.env`:

```env
VITE_CONTRACT_ADDRESS=0xYourDeployedContractAddress
VITE_CHAIN_ID=84532
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

### 6️⃣ Run Frontend

```bash
cd frontend

# Development mode
npm run dev

# Build untuk production
npm run build

# Preview production build
npm run preview
```

Aplikasi akan berjalan di `http://localhost:3000`

## 🎯 Cara Menggunakan Platform

### Untuk Users:

1. **Connect Wallet**
   - Klik tombol "Connect Wallet" di header
   - Pilih MetaMask atau wallet lain
   - Approve connection

2. **Claim Free Ticket**
   - Buka halaman Profile
   - Klik "Claim Free Ticket" (tersedia setiap 24 jam)

3. **Buy Extra Tickets**
   - Browse raffles di halaman Raffles
   - Pilih raffle yang aktif
   - Input jumlah tiket yang ingin dibeli
   - Klik "Buy Tickets"
   - Approve transaksi di wallet

4. **Check Leaderboard**
   - Lihat top 100 winners
   - Track progress Anda

### Untuk Raffle Creators:

1. **Prepare NFTs**
   - Pastikan Anda memiliki NFT yang ingin di-raffle
   - Approve contract untuk transfer NFT Anda

2. **Create Raffle**
   - Call function `createRaffle` di contract
   - Input array of NFT contract addresses
   - Input array of token IDs
   - Set duration (minimal 1 hari, maksimal 30 hari)

3. **Draw Winner**
   - Setelah raffle berakhir, call `drawWinner`
   - Chainlink VRF akan select winner secara random
   - Winner bisa claim NFT dengan call `claimPrizes`

## 🔒 Security Features

- ✅ **ReentrancyGuard** - Mencegah reentrancy attacks
- ✅ **Pausable** - Emergency stop mechanism
- ✅ **Ownable** - Controlled admin functions
- ✅ **Chainlink VRF** - Provably fair randomness
- ✅ **Input Validation** - Comprehensive checks
- ✅ **Safe Math** - Solidity 0.8+ overflow protection

## 📱 Multi-Platform Support

### Web
- Buka di browser: Chrome, Firefox, Safari, Edge
- Responsive design untuk semua ukuran layar

### Mobile
1. **Android**: Buka di MetaMask Browser atau WalletConnect supported apps
2. **iOS**: Buka di MetaMask Browser atau WalletConnect supported apps

### Desktop
- Windows, Mac, Linux
- Gunakan desktop wallet seperti Frame atau browser extension

## 🌐 Base Network Integration

Platform ini dioptimalkan untuk Base Network:

- **Low Gas Fees** - Transaksi murah dibanding Ethereum mainnet
- **Fast Confirmation** - Block time ~2 detik
- **Ethereum Security** - Rollup secured by Ethereum
- **Easy Bridging** - Bridge dari Ethereum dengan mudah

### Add Base Network ke MetaMask:

```
Network Name: Base Sepolia
RPC URL: https://sepolia.base.org
Chain ID: 84532
Currency Symbol: ETH
Block Explorer: https://sepolia.basescan.org
```

## 🎨 Farcaster Integration (Coming Soon)

Platform ini juga support Farcaster untuk:
- Social login
- Share raffle results
- Community engagement
- NFT showcasing

## 💡 Tips untuk Non-Programmers

### Mendapatkan Testnet ETH:
1. Kunjungi https://faucet.quicknode.com/base/sepolia
2. Connect wallet Anda
3. Request testnet ETH
4. Tunggu beberapa menit

### Mendapatkan LINK Tokens:
1. Kunjungi https://faucets.chain.link/base-sepolia
2. Connect wallet Anda
3. Request LINK tokens untuk VRF subscription

### Deploy Contract Tanpa Coding:
1. Gunakan Remix IDE: https://remix.ethereum.org
2. Copy-paste smart contract code
3. Compile dan deploy langsung dari browser
4. Atau gunakan Hardhat seperti di guide ini

## 🐛 Troubleshooting

### Contract Deploy Failed
- Pastikan Anda punya cukup Base Sepolia ETH
- Check private key di `.env` benar
- Verify RPC URL works

### Transaction Failed
- Check gas price dan limit
- Ensure wallet has enough ETH
- Try increasing gas limit

### Frontend Can't Connect
- Check contract address di `.env`
- Verify chain ID correct (84532 for Base Sepolia)
- Clear browser cache dan refresh

### VRF Not Working
- Ensure contract is added as consumer
- Check subscription has enough LINK
- Verify VRF configuration correct

## 📊 Cost Breakdown

### Development Costs (FREE):
- ✅ Code & Setup: FREE (open source)
- ✅ Testing: FREE (testnet)
- ✅ Frontend Hosting: FREE (Vercel free tier)

### Operational Costs:
- 🔹 Chainlink VRF: ~0.5 LINK per draw (~$5)
- 🔹 Gas Fees: ~$0.50-$2 per transaction on Base
- 🔹 Domain (optional): ~$10-15/year

### Revenue Model:
- 💰 5% fee dari setiap ticket purchase
- 💰 Estimasi: 1000 tickets/day × $0.15 = $150/day
- 💰 Fee: $150 × 5% = $7.50/day profit
- 💰 Monthly: ~$225/month

## 🚀 Deployment ke Production

### Deploy Contract ke Base Mainnet:

```bash
cd contracts
npm run deploy:base
npm run verify:base
```

### Deploy Frontend ke Vercel:

```bash
cd frontend

# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Atau connect GitHub repository ke Vercel dashboard untuk auto-deploy.

## 📈 Scaling & Optimization

### Untuk Meningkatkan Volume:

1. **Marketing**
   - Promote di social media
   - Partner dengan NFT projects
   - Influencer collaborations

2. **Features**
   - Multi-chain support
   - Batch raffles
   - Premium memberships
   - Referral rewards

3. **Optimization**
   - Cache leaderboard data
   - Optimize gas usage
   - CDN for assets

## 🤝 Support & Community

Jika Anda membutuhkan bantuan:

1. Check dokumentasi ini
2. Review code comments
3. Search GitHub issues
4. Join Discord community
5. Contact support

## 📄 License

MIT License - Free to use for commercial and personal projects.

## 🎯 Roadmap

- ✅ Phase 1: Core raffle functionality
- ✅ Phase 2: Frontend UI/UX
- 🔄 Phase 3: Farcaster integration
- 📅 Phase 4: Multi-chain support
- 📅 Phase 5: Mobile apps (native)
- 📅 Phase 6: DAO governance

## 🙏 Credits

Built with ❤️ using:
- OpenZeppelin
- Chainlink
- Base Network
- React & Vite
- RainbowKit & wagmi

---

**Made for the community, by the community** 🚀

For questions or support, open an issue on GitHub.

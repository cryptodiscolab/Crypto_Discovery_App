# 📘 Panduan Deployment Lengkap untuk Pemula

Panduan ini akan membantu Anda men-deploy aplikasi NFT Raffle dari awal sampai akhir, bahkan jika Anda tidak familiar dengan programming.

## 📝 Checklist Persiapan

Sebelum mulai, pastikan Anda sudah:

- [ ] Install Node.js dari https://nodejs.org (versi 20 atau lebih baru)
- [ ] Install Git dari https://git-scm.com
- [ ] Punya wallet MetaMask (install dari https://metamask.io)
- [ ] Punya Base Sepolia ETH (gratis dari faucet)
- [ ] Punya text editor (VSCode recommended: https://code.visualstudio.com)

---

## 🎯 LANGKAH 1: Setup Awal

### 1.1 Download & Extract Project

```bash
# Buka Terminal/Command Prompt
# Di Windows: tekan Win+R, ketik "cmd", enter
# Di Mac: tekan Cmd+Space, ketik "terminal", enter

# Navigasi ke folder project
cd path/to/nft-raffle-app

# List files untuk confirm
ls
```

### 1.2 Install Dependencies

```bash
# Install dependencies untuk smart contract
cd contracts
npm install

# Tunggu sampai selesai (bisa 2-5 menit)
# Kalau ada warning, ignore saja (yang penting no errors)

# Install dependencies untuk frontend
cd ../frontend
npm install

# Tunggu sampai selesai
```

---

## 🔑 LANGKAH 2: Setup Wallet & Get Testnet Funds

### 2.1 Export Private Key dari MetaMask

**⚠️ PENTING: JANGAN SHARE PRIVATE KEY KE SIAPAPUN!**

1. Buka MetaMask
2. Klik icon 3 titik (⋮) di pojok kanan atas
3. Klik "Account details"
4. Klik "Show private key"
5. Masukkan password MetaMask Anda
6. Klik "Confirm"
7. **Copy private key** (simpan di tempat aman)

### 2.2 Get Base Sepolia ETH (Gratis)

1. Kunjungi: https://faucet.quicknode.com/base/sepolia
2. Connect wallet MetaMask Anda
3. Klik "Get Base Sepolia ETH"
4. Tunggu 1-2 menit
5. Check balance di MetaMask (pastikan ada ETH)

### 2.3 Get LINK Tokens (Gratis)

1. Kunjungi: https://faucets.chain.link/base-sepolia
2. Connect wallet MetaMask Anda
3. Klik "Request 10 LINK"
4. Tunggu 1-2 menit
5. Check balance (pastikan dapat LINK)

---

## 🔗 LANGKAH 3: Setup Chainlink VRF

### 3.1 Create VRF Subscription

1. Kunjungi: https://vrf.chain.link/
2. Klik "Connect Wallet" → Connect MetaMask
3. Switch network ke "Base Sepolia"
4. Klik "Create Subscription"
5. Approve transaksi di MetaMask
6. Tunggu konfirmasi (~10 detik)

### 3.2 Fund Subscription

1. Setelah subscription created, klik "Fund Subscription"
2. Masukkan amount: **2 LINK** (minimum)
3. Klik "Fund Subscription"
4. Approve transaksi di MetaMask
5. **Copy Subscription ID** (contoh: 1234) - SIMPAN INI!

---

## ⚙️ LANGKAH 4: Setup Environment Variables

### 4.1 Create .env File

```bash
# Kembali ke root folder project
cd ..

# Copy .env.example ke .env
cp .env.example .env

# Buka .env dengan text editor
# Di Windows: notepad .env
# Di Mac: nano .env
```

### 4.2 Fill in .env File

Edit file `.env` dan isi dengan data Anda:

```env
# Paste private key yang Anda copy dari MetaMask
PRIVATE_KEY=0x1234567890abcdef...

# Basescan API Key (optional untuk verify)
# Dapatkan gratis di: https://basescan.org/myapikey
BASESCAN_API_KEY=ABC123...

# VRF Subscription ID yang Anda copy tadi
VRF_SUBSCRIPTION_ID=1234

# Frontend config (akan diisi setelah deploy contract)
VITE_CONTRACT_ADDRESS=
VITE_CHAIN_ID=84532
VITE_WALLETCONNECT_PROJECT_ID=
```

### 4.3 Get WalletConnect Project ID (Gratis)

1. Kunjungi: https://cloud.walletconnect.com
2. Sign up / Login
3. Klik "Create New Project"
4. Beri nama: "NFT Raffle"
5. Copy Project ID
6. Paste ke `.env` di field `VITE_WALLETCONNECT_PROJECT_ID`

**Save file .env!**

---

## 🚀 LANGKAH 5: Deploy Smart Contract

### 5.1 Compile Contract

```bash
cd contracts

# Compile smart contract
npm run compile

# Output harus success, no errors
```

### 5.2 Deploy to Base Sepolia

```bash
# Deploy contract
npm run deploy:base-sepolia

# Tunggu proses deploy (30-60 detik)
# Output akan menampilkan contract address
# Contoh: NFTRaffle deployed to: 0x1234567890...

# COPY CONTRACT ADDRESS - SIMPAN INI!
```

### 5.3 Add Consumer to VRF Subscription

**SANGAT PENTING!** Tanpa langkah ini, raffle tidak bisa draw winner!

1. Kembali ke: https://vrf.chain.link/
2. Klik subscription Anda
3. Klik "Add Consumer"
4. Paste contract address yang baru Anda deploy
5. Klik "Add Consumer"
6. Approve transaksi di MetaMask
7. Tunggu konfirmasi

✅ **Done!** Contract sudah ready!

---

## 🎨 LANGKAH 6: Setup & Run Frontend

### 6.1 Update Frontend .env

```bash
cd ../frontend

# Edit .env file
# Di Windows: notepad .env
# Di Mac: nano .env
```

Update dengan contract address Anda:

```env
VITE_CONTRACT_ADDRESS=0x1234567890abcdef... # paste contract address Anda
VITE_CHAIN_ID=84532
VITE_WALLETCONNECT_PROJECT_ID=your_project_id # dari step 4.3
```

### 6.2 Run Development Server

```bash
# Start development server
npm run dev

# Output:
# ➜  Local:   http://localhost:3000/
# ➜  Network: http://192.168.x.x:3000/
```

### 6.3 Test Aplikasi

1. Buka browser
2. Kunjungi: http://localhost:3000
3. Klik "Connect Wallet"
4. Approve connection di MetaMask
5. Test claim free ticket
6. Test buy tickets

✅ **Aplikasi sudah berjalan lokal!**

---

## 🌐 LANGKAH 7: Deploy to Production (Vercel)

### 7.1 Push Code ke GitHub

```bash
# Initialize git (kalau belum)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Create repo di GitHub
# 1. Kunjungi: https://github.com/new
# 2. Beri nama: nft-raffle-app
# 3. Klik "Create repository"
# 4. Copy URL repo (contoh: https://github.com/yourusername/nft-raffle-app.git)

# Add remote
git remote add origin https://github.com/yourusername/nft-raffle-app.git

# Push
git push -u origin main
```

### 7.2 Deploy ke Vercel

1. Kunjungi: https://vercel.com
2. Sign up / Login dengan GitHub
3. Klik "Add New Project"
4. Import repository "nft-raffle-app"
5. Configure project:
   - Framework: Vite
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. Add Environment Variables:
   - `VITE_CONTRACT_ADDRESS`: your_contract_address
   - `VITE_CHAIN_ID`: 84532
   - `VITE_WALLETCONNECT_PROJECT_ID`: your_project_id
7. Klik "Deploy"
8. Tunggu 2-3 menit

✅ **Aplikasi live di internet!**

URL akan seperti: `https://nft-raffle-app.vercel.app`

---

## 🎯 LANGKAH 8: Test Production App

1. Buka URL Vercel Anda
2. Connect wallet
3. Pastikan network Base Sepolia
4. Test semua fitur:
   - ✅ Connect wallet
   - ✅ Claim free ticket
   - ✅ Buy tickets
   - ✅ View raffles
   - ✅ View profile
   - ✅ View leaderboard

---

## 🚀 LANGKAH 9: Deploy ke Base Mainnet (Production)

**⚠️ Hanya lakukan ini jika Anda sudah test semuanya di testnet!**

### 9.1 Get Base Mainnet ETH

1. Bridge ETH dari Ethereum mainnet ke Base
2. Kunjungi: https://bridge.base.org
3. Bridge minimal 0.1 ETH

### 9.2 Get LINK on Base Mainnet

1. Bridge LINK atau buy di DEX
2. Need minimal 5 LINK

### 9.3 Create VRF Subscription (Mainnet)

1. Kunjungi: https://vrf.chain.link/
2. Switch to Base Mainnet
3. Create subscription
4. Fund dengan 5 LINK

### 9.4 Deploy Contract (Mainnet)

```bash
cd contracts

# Update .env
# Change VITE_CHAIN_ID to 8453

# Deploy
npm run deploy:base

# Copy contract address
# Add as VRF consumer
```

### 9.5 Update Frontend & Redeploy

1. Update `.env` dengan contract address mainnet
2. Change `VITE_CHAIN_ID` to `8453`
3. Push to GitHub
4. Vercel akan auto-deploy

---

## 🎊 SELESAI!

Aplikasi Anda sekarang:
- ✅ Live di internet
- ✅ Berjalan di Base Network
- ✅ Terhubung dengan Chainlink VRF
- ✅ Ready untuk users

---

## 💡 Tips Tambahan

### Monetization
- 5% fee dari setiap ticket = passive income
- Estimasi: 1000 tickets/day = $7.50 profit/day
- Monthly: ~$225

### Marketing
- Share di Twitter/X dengan hashtag #Base #NFT
- Post di Reddit r/BaseNetwork
- Join Base Discord dan promote
- Partner dengan NFT projects

### Maintenance
- Monitor VRF LINK balance (top up jika < 2 LINK)
- Check contract balance untuk withdraw fees
- Update frontend kalau ada bug
- Add new features

---

## 🆘 Troubleshooting Common Issues

### "Insufficient funds" Error
➡️ **Solution**: Get more ETH dari faucet atau bridge

### "Transaction failed"
➡️ **Solution**: Increase gas limit atau try again

### "VRF fulfillment failed"
➡️ **Solution**: Check VRF subscription has LINK

### "Cannot connect wallet"
➡️ **Solution**: Check MetaMask installed dan unlocked

### "Wrong network"
➡️ **Solution**: Switch to Base Sepolia in MetaMask

---

## 📞 Butuh Bantuan?

Kalau stuck di step manapun:

1. Read error message carefully
2. Google the error
3. Check documentation lagi
4. Ask in Base Discord: https://discord.gg/base
5. Open GitHub issue

**Semangat! Anda pasti bisa! 🚀**

---

*Last updated: 2025*

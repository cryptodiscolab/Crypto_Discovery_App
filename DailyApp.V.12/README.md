# DailyApp V12 - Independent Project Folder

This folder contains the standalone V12 implementation of DailyApp with verification support.

## 📂 Structure

- `contracts/` - Support contract V12 (`DailyAppV12Secured.sol`)
- `scripts/` - Deployment script (`deploy-v12.js`)
- `hardhat.config.js` - Hardhat configuration
- `package.json` - Dependencies and scripts

## 🚀 Setup & Deploy

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   - Copy `.env.example` to `.env`
   - Fill in your `PRIVATE_KEY`, `ALCHEMY_API_KEY`, etc.
   - Set `VERIFIER_ADDRESS` (the wallet address that your backend server will use)

3. **Deploy**
   ```bash
   # Deploy to Sepolia
   npm run deploy:sepolia
   ```

## 🔐 Verification System

This contract works in tandem with the Verification Server. Ensure you have granted the `VERIFIER_ROLE` to your backend server's wallet address.

See `../VERIFICATION_GUIDE.md` for full system details.

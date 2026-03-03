---
name: Raffle Frontend Integration Manager
description: Protokol dan standar untuk mengintegrasikan NFT Raffle ke frontend, mencakup buyTickets, claimPrize, createSponsorshipRaffle, dan XP awarding via backend.
---

# Raffle Frontend Integration Manager Skill

Skill ini mendefinisikan standar wajib untuk implementasi fitur NFT Raffle pada frontend Crypto Disco App. Setiap interaksi dengan smart contract `CryptoDiscoRaffle.sol` harus mengikuti protokol ini.

## 🎰 Kompetensi Inti

### 1. Contract Interaction Standard
- **Address Canonical**: Selalu gunakan `CONTRACTS.RAFFLE` dari `src/lib/contracts.js` — JANGAN hardcode.
- **ABI Source**: Gunakan `ABIS.RAFFLE` atau `RAFFLE_ABI` dari `src/lib/contracts.js` (keduanya Proxy-based, backward compatible).
- **Verified Raffle (Sepolia)**: `0x2c28bced53Cdfe9d9ECe7DFa79fE1066e453DE08` (`VITE_RAFFLE_ADDRESS`)

### 2. Import Standard
```javascript
// ✅ Preferred (new code):
import { ABIS, CONTRACTS } from '../lib/contracts';
const RAFFLE_ADDRESS = CONTRACTS.RAFFLE;
// Usage: abi: ABIS.RAFFLE

// ✅ Legacy (still works):
import { RAFFLE_ABI, CONTRACTS } from '../lib/contracts';
// Usage: abi: RAFFLE_ABI (transparent proxy)
```

### 3. Core Hook: useRaffle.js
Semua interaksi raffle harus melalui hook `useRaffle`:
- **`buyTickets(raffleId, amount)`**: Beli tiket → tunggu tx receipt → award XP via backend.
- **`claimPrize(raffleId)`**: Klaim hadiah jika user adalah pemenang (`claimRafflePrize`).
- **`drawRaffle(raffleId)`**: Admin draw pemenang (`drawWinner` — admin only).
- **`createSponsorshipRaffle({...})`**: Sponsor buat raffle baru + deposit + fee 5%.
- **`withdrawEarnings()`**: Sponsor tarik pendapatan tiket (`withdrawSponsorBalance`).

### 4. XP Awarding Pattern (Zero-Trust Backend)
Setelah `buyTickets` berhasil on-chain:
1. Frontend sign message `Claim XP for Raffle Purchase\\nRaffle ID: ...`
2. Call backend via Next.js API Routes (Server-Side). **DILARANG** melakukan update XP langsung melalui Supabase client side.
3. Backend `/api/tasks/verify` memverifikasi signature → insert ke `user_task_claims` via Service Role Key → increment `total_xp`.

### 5. Data Display Standard (useRaffleInfo)
Field yang dikembalikan oleh `getRaffleInfo`:
```
raffleId, totalTickets, maxTickets, targetPrizePool, prizePool,
participants[], winners[], winnerCount, isActive, isFinalized,
sponsor, metadataURI, endTime, prizePerWinner
```
- Gunakan `formatEther` dari `viem` untuk display nilai ETH.
- Hitung `progress = (totalTickets / maxTickets) * 100`.
- Hitung `timeLeft` dari `endTime - Date.now()/1000`.

### 6. RafflesPage Filter Logic
Filter dilakukan di dalam `<RaffleRow>` bukan di parent:
- `filter === 'active'` → sembunyikan jika `!raffle.isActive`
- `filter === 'completed'` → sembunyikan jika `!raffle.isFinalized`

### 7. Ticket Price
Harga tiket diambil dari kontrak `MasterX` via:
```js
functionName: 'getTicketPriceInETH' // CONTRACTS.MASTER_X
```
BUKAN dari kontrak Raffle. Ini adalah design intentional.

## ⛽ Paymaster Integration (Gasless Transactions)

**Hook**: `usePaymaster.js` — mendeteksi EIP-5792 via `useCapabilities` dari Wagmi v2.

### Flow Gasless:
1. `useCapabilities()` → cek `chainCapabilities.paymasterService.supported`
2. Jika supported → `useSendCalls` dengan `{ calls: [...], capabilities: { paymasterService: { url: VITE_PAYMASTER_URL } } }`
3. Jika tidak supported → fallback otomatis ke `writeContractAsync` (tx biasa)

### Env Variable:
```
VITE_PAYMASTER_URL=https://api.developer.coinbase.com/rpc/v1/base-sepolia/{ONCHAINKIT_API_KEY}
```

### UI Indicator:
- `<GaslessBadge />` muncul otomatis jika wallet mendukung (Coinbase Smart Wallet).
- Label tombol berubah dari "Buy Ticket" → "⛽ Buy Free".

### Kompatibilitas:
| Wallet | Gasless |
|---|---|
| Coinbase Smart Wallet | ✅ |
| Coinbase Wallet (Smart mode) | ✅ |
| MetaMask | ❌ (fallback ke normal) |
| Rainbow | ❌ (fallback ke normal) |

## 📋 Checklist Sebelum Deploy Raffle Feature
- [ ] `RAFFLE_ABI` sudah include `buyTickets(uint256 raffleId, uint256 amount)`
- [ ] `drawWinner` (bukan `requestRaffleWinner`) sudah di ABI
- [ ] `claimRafflePrize(uint256 raffleId)` sudah di ABI
- [ ] `createSponsorshipRaffle` menerima value (ETH deposit + 5% fee)
- [ ] XP flowtesting: signature valid → backend `/api/tasks/verify` → DB updated
- [ ] `currentRaffleId()` untuk list raffles (1-indexed)
- [ ] Build lokal berhasil (`npm run build` exit code 0)

## 🚨 Pantangan
- JANGAN langsung tulis ke `user_task_claims` dari frontend.
- JANGAN gunakan `purchaseRaffleTickets` — sudah direname ke `buyTickets`.
- JANGAN hardcode nilai ETH atau ticket price — selalu baca dari kontrak.
- **JANGAN impor ABI sebagai direct constant — gunakan Proxy dari `contracts.js`.**

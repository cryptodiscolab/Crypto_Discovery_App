# Mainnet Backend API Validation Blueprints

Peralihan ke **Base Mainnet** memunculkan risiko Sybil Attack (bot farming) dan hilangnya transaksi akibat Gas cost. Blueprint ini mengatur arsitektur Endpoint Vercel Serverless (`verification-server` dan `Raffle_Frontend/api`) agar siap menangani volume Mainnet secara aman.

## 1. `api/user-bundle.js` (User Identity & Onboarding)

### A. EIP-191 Auth Guard (Login Verifikasi)
Mencegah pembuatan profil palsu tanpa private key:
```javascript
// [Mainnet Policy] Dilarang upsert profile ke DB tanpa validasi EIP-191 Signature
const message = `Welcome to Crypto Disco Mainnet! \n\nNonce: ${generatedNonce}`;
const recoveredAddress = ethers.verifyMessage(message, signature);

if (recoveredAddress.toLowerCase() !== wallet_address.toLowerCase()) {
    throw new Error("401: Invalid Signature. Sybil Attack Prevented.");
}

// Lanjut upsert ke `user_profiles`
```

### B. Optimistic Trust + RPC Fallback Module (Daily Claim)
```javascript
// action=xp flow
// 1. Terima tx_hash dari frontend.
// 2. Jika tx_hash ada, kita tidak lagi mengandalkan `readContract(userStats)` 
//    yang mungkin sangat lambat di Mainnet pada jam padat.
try {
    const txReceipt = await provider.waitForTransaction(tx_hash, 1, 10000); // 10s wait
    if (txReceipt.status === 1) {
        // [Mainnet Safety] Paksa update DB segera agar UI tidak glitch!
        await supabase.rpc('award_daily_xp', { p_wallet: wallet_address });
    }
} catch (e) {
    // 3. RPC Lag Fallback: Tetap kreditkan jika RPC timeout,
    //    selama tx_hash eksis, indexer off-chain akan menyeimbangkan nanti.
}
```

## 2. `api/tasks-bundle.js` (Verification Hub)

### Identity Verification (Neynar & Farcaster)
Pada Mainnet, Reward berupa Poin atau Tiket Gacha punya nilai ekonomi. Tugas sosial harus 100% tervalidasi.
```javascript
// Pengecekan Sybil Identity (1 Farcaster = 1 Wallet)
const { data: existingFarchip } = await supabase
    .from('user_profiles')
    .select('wallet_address')
    .eq('fid', userFid)
    .single();

if (existingFarchip && existingFarchip.wallet_address !== requesterWallet) {
    throw new Error("403: Identity Locked. This Farcaster Account is already linked to another wallet.");
}
```

## 3. Gas Fee Handling (`app/api/raffle-bundle.js`)
Di Mainnet, pembelian tiket dan penciptaan UGC Sponsor mengeluarkan nominal ETH sungguhan (`MSG.VALUE`).
- **Blueprint Rule**: Semua kalkulasi biaya (Fee) di Server **HARUS BERASAL DARI CONTRACT RPC BUKAN DARI ENVIRONMENT**. Variabel `VITE_` hanyalah _fallback_ jika RPC gagal.

```javascript
// Mengambil live surcharge rate langsung dari Mainnet untuk akurasi Fee
const feeData = await RaffleContract.read_sponsorship_fee();
const requiredEth = calculateEthEquivalent(feeData, liveEthPrice);
```

---
*Blueprint ini menjadi panduan saat agen akan memodifikasi logika `.js` pada Node.js/Vercel saat transisi Mainnet dimulai.*

# 📄 Dokumentasi Ekosistem Smart Contract: SBT & Membership NFT

Dokumentasi ini merangkum mekanisme teknis, aturan ekonomi, dan alur integrasi antara sistem **Soulbound Token (SBT)** dan **Membership NFT** dalam ekosistem CryptoDisco.

---

## 1. Membership NFT (KTP Digital Pemain)
**Contract**: `DailyApp.sol` (V14 - ERC721 - Soulbound)  
**Address**: `0x888fE02bd09642de385E55DdC6D8a7Ab5580f834` (Base Sepolia)
**Tujuan**: Identitas pemain, sistem leveling, multi-token reward, dan pengganda (multiplier) XP.

### 📊 Rincian Tier & Ekonomi (Lurah V2)
| Tier | Index | XP Reqd | Multiplier (BP) | Multiplier (x) |
| :--- | :--- | :--- | :--- | :--- |
| **Rookie** | 0 | 0 | 10000 | 1.00x |
| **Bronze** | 1 | 1,000 | 10500 | 1.05x |
| **Silver** | 2 | 5,000 | 11000 | 1.10x |
| **Gold** | 3 | 20,000 | 12000 | 1.20x |
| **Platinum** | 4 | 100,000 | 13000 | 1.30x |
| **Diamond** | 5 | 500,000 | 15000 | 1.50x |

### ✅ Task Multiplier Compatibility Matrix
| Nama Aktivitas | Kategori | Boosted? | Keterangan |
| :--- | :--- | :--- | :--- |
| **Social Task Claim** | Off-chain | ✅ YES ⚡ | Melalui `tasks-bundle.js` |
| **Social Task Verify** | Off-chain | ✅ YES ⚡ | Melalui `tasks-bundle.js` |
| **Raffle Ticket Buy** | Off-chain | ✅ YES ⚡ | Melalui `tasks-bundle.js` |
| **Raffle Win Reward** | Off-chain | ✅ YES ⚡ | Melalui `tasks-bundle.js` |
| **Raffle Creation XP** | Off-chain | ✅ YES ⚡ | Melalui `user-bundle.js` |
| **Standard On-chain Task**| On-chain | ✅ YES ⚡ | Native di `DailyAppV12Secured` |
| **Daily Bonus (Check-in)**| On-chain | ❌ NO | Flat Reward (Contract) |
| **Referral Commission**  | On-chain | ❌ NO | Flat Bounty (Contract) |

### 🔒 Karakteristik Teknis
- **Soulbound**: NFT tidak bisa ditransfer atau dijual ke wallet lain (Baris 883-894).
- **Sequential Upgrade**: User harus naik level secara bertahap (Bronze ➔ Silver ➔ Gold, dst).
- **Single NFT**: Satu wallet hanya memegang satu NFT yang statusnya diperbarui (upgrade) saat naik level.

---

## 2. SBT Feature (Sistem Bagi Hasil)
**Contract**: `NewMasterX.sol` (v3.63.x)  
**Address**: `0x980770dAcE8f13E10632D3EC1410FAA4c707076c` (Base Sepolia)
**Tujuan**: Controller utama, distribusi pendapatan aplikasi (Revenue Sharing), dan point system management.

### 💰 Mekanisme Revenue Split
Semua pendapatan yang masuk ke contract dibagi secara otomatis:
- **40%** Owner
- **20%** Operations
- **30% SBT Community Pool** (Ditabung untuk dibagikan ke pemegang status SBT)
- **10%** Treasury

### 🏆 Distribusi Bobot Tier SBT
Isi dari kolam 30% tersebut dibagikan kepada user yang memiliki status SBT on-chain dengan proporsi:
- **Diamond SBT**: x10 porsi kolam (Weight: 10).
- **Platinum SBT**: x5 porsi kolam (Weight: 5).
- **Gold SBT**: x3 porsi kolam (Weight: 3).
- **Silver SBT**: x2 porsi kolam (Weight: 2).
- **Bronze SBT**: x1 porsi kolam (Weight: 1).

## 4. Raffle & UGC Manager (Protocol V2.1)
**Contract**: `CryptoDiscoRaffle.sol`
**Address**: `0xE7CB85c307f1c368DCB9FFcfa5f3e02324eaf1f3` (Base Sepolia)
**Tujuan**: NFT Gacha, Sponsor Missions, dan Refund Protocol Automatis.

---

## 5. Sistem Verifikasi Sosial (Proof of Personhood)
**Server**: `Verification Service` (Node.js/Ethers)  
**Tujuan**: Memastikan user adalah manusia asli sebelum mendapatkan tier SBT.

### 🔄 Multi-Platform Fallback
Sistem mendukung dua jalur verifikasi utama:
1. **Farcaster Sync**: Menggunakan API Neynar untuk memverifikasi kepemilikan FID dan menghubungkannya ke wallet.
2. **Twitter (X) Fallback**: Jalur cadangan bagi user yang tidak memiliki Farcaster melalui mekanisme posting tweet verifikasi.

---

## 🚀 Alur Perjalanan User (User Journey)
1. **Entry**: User melakukan `mintNFT` level Bronze di `DailyAppV12Secured.sol`.
2. **Activity**: User mengerjakan task harian untuk mengumpulkan XP.
3. **Verification**: User melakukan sinkronisasi sosial (Farcaster/Twitter).
4. **Acquisition**: Setelah XP cukup, user melakukan `upgradeNFT` ke level yang lebih tinggi.
5. **Reward**: Admin memberikan status **SBT Tier** on-chain di `CryptoDiscoMaster.sol` berdasarkan keaktifan user.
6. **Claim**: User melakukan `claimSBTRewards` untuk menarik dividen (ETH/USDC) hasil bagi pendapatan aplikasi.

---

## 📑 Referensi Kode Utama

### Perhitungan Reward (DailyAppV12Secured.sol)
```solidity
function calculateTaskReward(address _user, uint256 _taskId) public view returns (...) {
    base = tasks[_taskId].baseReward;
    multiplier = nftConfigs[userStats[_user].currentTier].multiplierBP;
    finalReward = (base * multiplier) / 10000;
    return (base, finalReward, multiplier);
}
```

### Penegakan Soulbound (DailyAppV12Secured.sol)
```solidity
if (from != address(0) && to != address(0)) revert Unauthorized();
```

### Definisi Bobot SBT (CryptoDiscoMaster.sol)
```solidity
uint256 public constant DIAMOND_WEIGHT = 10;
uint256 public constant PLATINUM_WEIGHT = 5;
uint256 public constant GOLD_WEIGHT = 3;
uint256 public constant SILVER_WEIGHT = 2;
uint256 public constant BRONZE_WEIGHT = 1;
```

---
**Status**: Produksi (Ready for Deploy/Integration)
**Jaringan**: Base Sepolia

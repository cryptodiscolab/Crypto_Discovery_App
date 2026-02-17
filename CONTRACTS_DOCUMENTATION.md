# 📄 Dokumentasi Ekosistem Smart Contract: SBT & Membership NFT

Dokumentasi ini merangkum mekanisme teknis, aturan ekonomi, dan alur integrasi antara sistem **Soulbound Token (SBT)** dan **Membership NFT** dalam ekosistem CryptoDisco.

---

## 1. Membership NFT (KTP Digital Pemain)
**Contract**: `DailyAppV12Secured.sol` (ERC721 - Soulbound)  
**Tujuan**: Identitas pemain, sistem leveling, dan pengganda (multiplier) XP.

### 📊 Rincian Tier & Ekonomi
| Tier | Point (XP) Reqd | Harga (ETH) | Multiplier | Bonus Harian | Max Supply |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Bronze** | 1,000 | 0.001 ETH | 1.1x | 50 XP | 10,000 |
| **Silver** | 5,000 | 0.005 ETH | 1.2x | 100 XP | 5,000 |
| **Gold** | 20,000 | 0.02 ETH | 1.5x | 200 XP | 2,000 |
| **Platinum** | 100,000 | 0.1 ETH | 2.0x | 500 XP | 1,000 |
| **Diamond** | 500,000 | 0.5 ETH | 3.0x | 1,000 XP | 100 |

### 🔒 Karakteristik Teknis
- **Soulbound**: NFT tidak bisa ditransfer atau dijual ke wallet lain (Baris 883-894).
- **Sequential Upgrade**: User harus naik level secara bertahap (Bronze ➔ Silver ➔ Gold, dst).
- **Single NFT**: Satu wallet hanya memegang satu NFT yang statusnya diperbarui (upgrade) saat naik level.

---

## 2. SBT Feature (Sistem Bagi Hasil)
**Contract**: `CryptoDiscoMaster.sol` (Internal Tier Mapping)  
**Tujuan**: Distribusi pendapatan aplikasi (Revenue Sharing) kepada komunitas.

### 💰 Mekanisme Revenue Split
Semua pendapatan yang masuk ke contract dibagi secara otomatis:
- **40%** Owner
- **20%** Operations
- **30% SBT Community Pool** (Ditabung untuk dibagikan ke pemegang status SBT)
- **10%** Treasury

### 🏆 Distribusi Bobot Tier SBT
Isi dari kolam 30% tersebut dibagikan kepada user yang memiliki status SBT on-chain dengan proporsi:
- **Gold SBT**: 50% porsi kolam.
- **Silver SBT**: 30% porsi kolam.
- **Bronze SBT**: 20% porsi kolam.

---

## 3. Sistem Verifikasi Sosial (Proof of Personhood)
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
uint256 public constant GOLD_WEIGHT = 50;
uint256 public constant SILVER_WEIGHT = 30;
uint256 public constant BRONZE_WEIGHT = 20;
```

---
**Status**: Produksi (Ready for Deploy/Integration)
**Jaringan**: Base Sepolia

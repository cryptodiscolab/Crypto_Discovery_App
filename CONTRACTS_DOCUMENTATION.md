# 📄 Dokumentasi Ekosistem Smart Contract: SBT & Membership NFT

Dokumentasi ini merangkum mekanisme teknis, aturan ekonomi, dan alur integrasi antara sistem **Soulbound Token (SBT)** dan **Membership NFT** dalam ekosistem CryptoDisco.

> **Visi Utama**: Semua XP harus on-chain. Tidak ada pemisahan XP database vs on-chain.

---

## 1. Membership NFT (KTP Digital Pemain)

### DailyAppV16 (Latest — All XP On-Chain)
**Contract**: `DailyAppV16.sol` (ERC721 - Soulbound - UUPS Upgradeable)
**Status**: 🟢 Live on Base Sepolia | **Proxy Address**: `0xb592D6819Ea310d83034cD80FDDC2e754D0a5353` | **Implementation**: `0x77f3E2CD30f871723b05Bf36C23a431B7e2d7c61`
**Tujuan**: Single source of truth untuk semua XP. Setiap aktivitas user dicatat on-chain langsung ke `userStats[].points`.

**Post-Deploy Wiring (22 Mei 2026):**
| Item | Target | Tx | Status |
|---|---|---|---|
| `setMasterX` | `0x980770dAcE8f13E10632D3EC1410FAA4c707076c` | `0x4e5d...48fd` | ✅ Verified |
| `RAFFLE_ROLE` | `0xE7CB85c307f1c368DCB9FFcfa5f3e02324eaf1f3` | `0x0a54...d773` | ✅ Verified |
| `VERIFIER_ROLE` | `0x52260C30697674A7C837feb2Af21BbF3606795C8` | `0xd60c...e811` | ✅ Verified |
| `SOCIAL_ROLE` | `0x52260C30697674A7C837feb2Af21BbF3606795C8` | `0x1295...13cd0` | ✅ Verified |
| `UGC_ROLE` | `0x52260C30697674A7C837feb2Af21BbF3606795C8` | `0xcde6...3777` | ✅ Verified |
| `MOJO_ROLE` | `0x52260C30697674A7C837feb2Af21BbF3606795C8` | `0xb1c6...9813` | ✅ Verified |
| `SWAP_ROLE` | `0x52260C30697674A7C837feb2Af21BbF3606795C8` | `0xafdc...c90` | ✅ Verified |
| `PURCHASE_ROLE` | `0x52260C30697674A7C837feb2Af21BbF3606795C8` | `0xcaad...f0a` | ✅ Verified |

**Perubahan dari V15:**
| Komponen | V15 | V16 |
|---|---|---|
| **Entitlement Verifier** | Ada (`ISBTMintEntitlementVerifier`) | ❌ **Dihapus** |
| **syncOffchainXP** | Ada | ❌ **Dihapus** |
| **Sumber XP** | On-chain + Database | ✅ **All On-Chain** |
| **Role baru** | ADMIN, VERIFIER | ✅ + RAFFLE, SOCIAL, UGC, MOJO, SWAP, PURCHASE |
| **Epoch rate limit** | Tidak ada | ✅ Per-channel 24h epoch |
| **Upgradeable** | Tidak (construct-only) | ✅ **UUPS** |
| **lifetimeXp** | Tidak ada | ✅ Ya, akumulasi seumur hidup |

**Channel XP Award:**
| Channel | Role | Fungsi | Rate Limit (/24h) |
|---|---|---|---|
| Daily Claim | User | `claimDailyBonus()` | 1x24h |
| On-chain Task | User | `doTask()` | Per task cooldown |
| Referral | Auto | Internal di `doTask()` | Setelah 3 task |
| Raffle Buy | `RAFFLE_ROLE` | `awardRaffleBuyXp()` | 5,000 XP |
| Raffle Win | `RAFFLE_ROLE` | `awardRaffleWinXp()` | 5,000 XP |
| Social Task | `SOCIAL_ROLE` | `awardSocialXp()` | 2,000 XP |
| UGC Task | `UGC_ROLE` | `awardUgcTaskXp()` | 10,000 XP |
| UGC Raffle | `UGC_ROLE` | `awardUgcRaffleXp()` | 10,000 XP |
| Mojo | `MOJO_ROLE` | `awardMojoXp()` | 500 XP |
| Swap | `SWAP_ROLE` | `awardSwapXp()` | 3,000 XP |
| Purchase | `PURCHASE_ROLE` | `awardPurchaseXp()` | 5,000 XP |
| Admin Batch | `ADMIN_ROLE` | `awardAdminBatchXp()` | Tanpa limit |

### DailyAppV15 (Current Live)
**Contract**: `DailyAppV15.sol`
**Address**: `0x0D6f339795EeA5129461388F25dE4f87e92b8DA2` (Base Sepolia)
**Status**: Legacy fallback — digantikan V16

### Versi Sebelumnya
**Contract**: `DailyAppV14.sol` — `0x888fE02bd09642de385E55DdC6D8a7Ab5580f834` (Base Sepolia)
**Contract**: `DailyAppV13.sol` — `0x81D65Cc9267e2eBF88D079e3598Ec78f48aE4B5D` (Base Sepolia)

### 📊 Rincian Tier & Ekonomi (Lurah V2)
| Tier | Index | XP Reqd | Multiplier (BP) | Multiplier (x) |
| :--- | :--- | :--- | :--- | :--- |
| **Rookie** | 0 | 0 | 10000 | 1.00x |
| **Bronze** | 1 | 1,000 | 10500 | 1.05x |
| **Silver** | 2 | 5,000 | 11000 | 1.10x |
| **Gold** | 3 | 20,000 | 12000 | 1.20x |
| **Platinum** | 4 | 100,000 | 13000 | 1.30x |
| **Diamond** | 5 | 500,000 | 15000 | 1.50x |

### 🔒 Karakteristik Teknis
- **Soulbound**: NFT tidak bisa ditransfer atau dijual ke wallet lain (`_update` override).
- **Sequential Upgrade**: User harus naik level secara bertahap (Bronze ➔ Silver ➔ Gold, dst).
- **Single NFT**: Satu wallet hanya memegang satu NFT yang statusnya diperbarui (upgrade) saat naik level.
- **Burn XP**: Saat mint/upgrade SBT via jalur on-chain, XP dibakar sesuai `config.pointsRequired`.
- **Upgradeable (V16)**: Admin bisa upgrade logic kontrak via UUPS tanpa migrasi data.

### ✅ Task Multiplier Compatibility Matrix
| Nama Aktivitas | Kategori | Boosted? | Sumber XP (V16) |
| :--- | :--- | :--- | :--- |
| **Social Task Claim** | On-chain | ✅ YES ⚡ | `awardSocialXp()` via SOCIAL_ROLE |
| **Social Task Verify** | On-chain | ✅ YES ⚡ | `awardSocialXp()` via VERIFIER_ROLE |
| **Raffle Ticket Buy** | On-chain | ✅ YES ⚡ | `awardRaffleBuyXp()` via RAFFLE_ROLE |
| **Raffle Win Reward** | On-chain | ✅ YES ⚡ | `awardRaffleWinXp()` via RAFFLE_ROLE |
| **Raffle Creation XP** | On-chain | ✅ YES ⚡ | `awardUgcRaffleXp()` via UGC_ROLE |
| **Standard On-chain Task**| On-chain | ✅ YES ⚡ | `doTask()` |
| **Daily Bonus (Check-in)**| On-chain | ❌ NO | `claimDailyBonus()` |
| **Referral Commission**  | On-chain | ❌ NO | Internal `doTask()` |
| **Mojo** | On-chain | ❌ NO | `awardMojoXp()` via MOJO_ROLE |
| **Swap Token** | On-chain | ❌ NO | `awardSwapXp()` via SWAP_ROLE |
| **Purchase Item** | On-chain | ❌ NO | `awardPurchaseXp()` via PURCHASE_ROLE |

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

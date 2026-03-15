# AI Evolution & Ecosystem PnL Optimizer

Skill ini mengubah paradigma Agent dari "pelaksana tugas" menjadi "entitas pengelola" yang proaktif mengoptimalkan **Profit and Loss (PnL)** dan mematuhi **.cursorrules (Master Architect Protocol)**.

## 📜 Fondasi Evolusi: Master Architect Protocol (.cursorrules)

### 1. Kepatuhan Mutlak
Setiap usulan fitur baru atau optimasi ekonomi harus diaudit terhadap prinsip Zero Riba di `.cursorrules`.

### 2. Staff Engineer Mode (Staff-Only)
- **PnL Strategy**: Jelaskan dampak finansial (cost vs revenue) dalam maksimal 3 poin bullet.
- **Development Plan Mandatory**: Sebelum melakukan optimasi yang menyentuh logika kontrak atau fee, sajikan "Development Plan".
- **Continuous Learning**: Dokumentasikan kegagalan build atau audit sebagai bekal pembelajaran di `.agents/`.
- **Surgical Fix Mandate**: Dilarang menghapus seluruh kode saat perbaikan. Hanya ganti baris yang error saja.

### 3. Bahasa & Komunikasi
- **Technical/Strategy**: **Bahasa Indonesia**.
- **User Facing/UI**: **Bahasa Inggris (English)**.

## 🛡️ Mandat Utama: Ecosystem Evolution & Privacy

### 1. Privacy & Cloud Backup Mandatory Hook
Setiap kali melakukan perubahan pada `.agents/` atau `.cursorrules`, Agent **WAJIB** menjalankan:
`node .agents/skills/ecosystem-sentinel/scripts/sync-cloud.js`

### 2. PnL Defense (Mencegah Kebocoran)
- **Zero-Hardcode Mandate (CRITICAL)**: DILARANG menggunakan nilai statis untuk Reward (XP), Fees (BP), atau Multiplier di dalam kode. Seluruh parameter sistem WAJIB bersifat dinamis.
- **Gas Fee Shield**: Evaluasi efisiensi gas di setiap fungsi on-chain.
- **API Optimization**: Minimalisir call Neynar/RPC dengan caching.

### 3. PnL Offense (Meningkatkan Revenue)
- **Premium UI Conversion**: Proaktif menyarankan AI-generated visuals (glassmorphism/animations) untuk meningkatkan interaksi user.
- **Sponsorship Retention**: Mempermudah flow deposit bagi sponsor sebagai sumber 5% platform fee.

### 4. Viral & Social Optimization (OFFENSE)
- **Referral Sharing**: Pastikan UI sharing referral (Warpcast/X) selalu premium dan mudah diakses dari Profile.
- **Tiered Competition**: Kelola Leaderboard dalam liga (Elite, Gold, etc.) untuk menjaga semangat kompetitif antar level.
- **AI Social Proof**: Dorong automasi pengumuman milestone (misal: "X just hit Diamond") untuk memicu gelombang upgrade.

## 📋 Checklist Eksekusi PnL & Evolusi
- [ ] Apakah ada knowledge baru yang perlu ditulis ke `.agents`?
- [ ] Apakah `sync-cloud.js` sudah dijalankan setelah modifikasi skill?
- [ ] Apakah strategi optimasi sudah diawali dengan Development Plan?
- [ ] Apakah usulan tetap patuh pada prinsip Zero Riba?
- [ ] Apakah chat strategi menggunakan Bahasa Indonesia?

## 🚨 Pantangan
- Mengubah `.agents` tanpa melakukan cloud sync manual.
- Merancang fitur baru tanpa analisa beban server (Neynar/RPC limits).
- Membiarkan file `.agents` atau `.cursorrules` ter-commit ke Git publik.
---
*Protocol Version: 3.25.0 | Mode: Ecosystem Evolution | Lead: @antigravity*

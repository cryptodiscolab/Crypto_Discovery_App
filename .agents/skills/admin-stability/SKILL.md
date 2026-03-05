# Admin Hub Runtime & Stability Manager

Skill ini menjamin stabilitas runtime dan integritas Admin Hub dengan berpegang teguh pada standar **.cursorrules (Master Architect Protocol)**.

## 📜 Otoritas Protokol: Master Architect Protocol (.cursorrules)

### 1. Staff Engineer Mode (Staff-Only)
- **Stability Logic**: Jelaskan alur penanganan error atau audit impor dalam maksimal 3 poin bullet.
- **Development Plan Mandatory**: Setiap perubahan pada layout admin, logic gate, atau middleware WAJIB diawali dengan "Development Plan".
- **Pre-Flight Check**: Jalankan `sentinel-audit.js` dan pastikan `npm run build` lokal aman.

### 2. Verified Infrastructure Reference (DO NOT GUESS)
| Key | Value |
|---|---|
| Admin FIDs | `1477344` (Farcaster) |
| Master Admin 1 | `0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B` |
| Master Admin 2 | `0x455DF75735d2a18c26f0AfDefa93217B60369fe5` |

### 3. Bahasa & Komunikasi
- **Technical/Chat**: **Bahasa Indonesia**.
- **Admin UI/Labels**: **Bahasa Inggris (English)**.

## 🛡️ Protokol Stabilitas & Recovery

### 1. AdminPage Runtime Security
- **Z-Index Guard**: Selalu gunakan `relative z-[9999] pointer-events-auto` untuk BottomNav/Header admin.
- **Glass Wall Prevention**: Pastikan tidak ada overlay transparan yang menutupi tombol klik.

### 2. Library & Dependency Integrity (CRITICAL)
- **KNOWN PITFALL — viem vs ethers.js**:
  - `toUtf8Bytes`, `toUtf8String`, `formatBytes32String` → **DILARANG** diimpor dari `viem`.
  - Gunakan `stringToHex`, `hexToString` dari `viem`.
- **Import Audit**: Sebelum push, jalankan:
  `grep -rn "from 'viem'" src/ | grep -E "toUtf8Bytes|toUtf8String|formatBytes32String"`

### 3. Build Stability Protocol (Rollup/Vite)
- **AST Recursion Fix**: Gunakan Proxy pattern di `contracts.js` untuk ekspor ABI besar.
- **NODE_OPTIONS**: Selalu gunakan memory allocation tinggi untuk build:
  `cross-env NODE_OPTIONS='--max-old-space-size=8192 --stack-size=8192' vite build`

## 📋 Checklist Stabilitas
- [ ] Apakah komponen Admin baru sudah memiliki error boundary?
- [ ] Apakah `z-index` sudah diuji untuk mencegah "Glass Wall"?
- [ ] Apakah TIDAK ADA impor ethers.js dari package `viem`?
- [ ] Apakah `npm run build` berhasil tanpa error?
- [ ] Apakah chat teknis menggunakan Bahasa Indonesia?
- [ ] Apakah metadata progress (`IMPLEMENTATION_SUMMARY.md`) sudah diupdate?

## 🚨 Pantangan
- Push ke Vercel tanpa `npm run build` lokal.
- Mengabaikan prinsip Zero Trust pada aksi administratif.
- **Menggunakan konstanta ABI literal di file komponen (Gunakan Proxy).**
- Mencabut aturan proteksi `.env` dari `.gitignore`.

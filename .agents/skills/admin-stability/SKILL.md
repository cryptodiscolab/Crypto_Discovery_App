---
name: Admin Hub Runtime & Stability Manager
description: Protokol untuk menjaga stabilitas runtime AdminPage, memastikan integritas impor library, dan kepatuhan standar UI/Security di area administratif. Termasuk Build Stability Protocol untuk Rollup/Vite.
---

# Admin Hub Stability & Protocol Manager

Skill ini menjamin stabilitas runtime dan integritas Admin Hub dengan berpegang teguh pada standar **.cursorrules (Master Architect Protocol)**. Ketahanan aplikasi terhadap error dan kemudahan navigasi bagi owner adalah prioritas utama, tanpa mengabaikan aspek keamanan *Zero-Trust*.

## 📜 Otoritas Protokol: Master Architect Protocol (.cursorrules)
Audit visual (z-index), validasi library Web3, dan penanganan status transaksi di Admin Hub harus selalu mengikuti spesifikasi teknis yang tertuang dalam `.cursorrules`.

## 🛡️ Protokol Stabilitas & Recovery

### 1. Agent Session & Context Preservation
- **State Checkpointing**: Selalu simpan ringkasan status pekerjaan terakhir (Checkpoint) di file `IMPLEMENTATION_SUMMARY.md` atau `walkthrough.md`. Jika agent mengalami limit/expiry, agent baru dapat melanjutkan dalam 1 langkah tanpa kehilangan konteks.
- **Token Optimization**: Hindari pembacaan file besar berulang kali. Gunakan `view_file_outline` dan `grep_search` secara efisien untuk menghemat kuota token.

### 2. AdminPage Runtime Security
- **Dynamic Import Validation**: Memastikan setiap komponen admin yang di-load secara *lazy* (`React.lazy`) memiliki fallback `Suspense` yang informatif dan tidak merusak layout (No Layout Shift).
- **Z-Index Guard**: Melakukan audit visual pada `AdminPage.jsx` untuk memastikan sidebar dan topbar selalu berada di layer teratas (`z-[9999]`) dan `pointer-events` berfungsi normal.
- **Component Decomposition**: Admin page harus tetap modular. Setiap tab/section harus diextract ke file terpisah di `src/components/admin/` dan lazy-loaded.

### 3. Library & Dependency Integrity (CRITICAL)
- **Anti-Guessing Check**: Setiap pemanggilan method dari `viem`, `wagmi`, atau `@coinbase/onchainkit` **HARUS** divalidasi kebenarannya sesuai versi yang terinstall di `node_modules` untuk menghindari runtime error.
- **KNOWN PITFALL — viem vs ethers.js**:
  - `toUtf8Bytes` → **ETHERS.JS ONLY**, TIDAK ADA di viem. Gunakan `stringToHex` dari viem.
  - `keccak256(stringToHex('ROLE_NAME', { size: 32 }))` → Pattern benar untuk viem.
  - `keccak256(toUtf8Bytes('ROLE_NAME'))` → **HANYA untuk ethers.js**, AKAN CRASH di viem build.
  - `toHex`, `fromHex`, `hexToString`, `stringToHex` → viem utilities.
  - `toUtf8Bytes`, `toUtf8String`, `formatBytes32String` → ethers.js utilities, **DILARANG** diimpor dari viem.
- **Import Validation Protocol**: Sebelum commit, jalankan audit:
  ```bash
  grep -rn "from 'viem'" src/ | grep -E "toUtf8Bytes|toUtf8String|formatBytes32String|parseBytes32String"
  ```
  Jika ditemukan → **WAJIB FIX** sebelum build.
- **Rollback Readiness**: Selalu siapkan strategi rollback jika update pada fitur Admin menyebabkan ketidakstabilan sistem produksi.

### 4. Zero-Trust Admin Execution
- **Signature Enforcement**: Setiap tindakan administratif (Grant Role, Set Fee, Update CMS) WAJIB melalui verifikasi tanda tangan kriptografis di backend.
- **Audit Logging**: Mencatat setiap perubahan status sistem yang krusial ke tabel `admin_audit_logs`.

## 🏗️ Build Stability Protocol (Rollup/Vite)

### Root Cause Analysis (RCA) — Build Crash Pattern
Build failure pada Rollup biasanya terdeteksi sebagai `findVariable` stack overflow pada `node-entry.js`. Ini bukan masalah memory — ini adalah **import resolution failure** yang memicu infinite recursion di AST binder.

### Diagnostic Steps
1. **Cek error message terlebih dahulu** — Jika error menyebut `"X" is not exported by "Y"`, itu adalah **invalid import** yang menjadi root cause.
2. **Disable treeshake sementara** — Ubah `rollupOptions.treeshake` ke `false` di `vite.config.js`. Jika build berhasil atau menunjukkan error baru yang lebih informatif, root cause adalah invalid import/export.
3. **Periksa semua impor dari `viem`** — Library `viem` TIDAK mengekspor fungsi ethers.js. Mixing ini adalah penyebab paling umum.

### Known Fixes
| Symptom | Root Cause | Fix |
|---|---|---|
| `findVariable` stack overflow | Invalid import dari viem (e.g., `toUtf8Bytes`) | Ganti dengan viem equivalent (`stringToHex`) |
| AST recursion pada binding | Large ABI constants diekspor sebagai literal | Gunakan Proxy pattern di `contracts.js` |
| `/*#__PURE__*/` warnings | ox library annotation | Aman diabaikan (warning only, bukan error) |
| Memory/stack exceeded | Rollup traverse seluruh viem tree | Tingkatkan `--max-old-space-size` dan `--stack-size` di build script |

### ABI Architecture Standard (contracts.js)
```javascript
// ✅ CORRECT: Proxy-based ABI export (prevents Rollup AST recursion)
const createAbiProxy = (name) => new Proxy([], {
    get: (target, prop) => {
        const realAbi = JSON.parse(abisDataRaw).ABIS[name] || [];
        return realAbi[prop];
    }
});
export const DAILY_APP_ABI = createAbiProxy('DAILY_APP');

// ❌ WRONG: Direct constant export (causes Rollup stack overflow)
export const DAILY_APP_ABI = JSON.parse(abisDataRaw).ABIS.DAILY_APP;
```

### Build Script Standard
```json
"build": "cross-env NODE_OPTIONS='--max-old-space-size=8192 --stack-size=8192' vite build"
```

## 📋 Checklist Stabilitas
- [ ] Apakah komponen Admin yang baru ditambahkan sudah menggunakan `Suspense`?
- [ ] Apakah `z-index` dan `pointer-events` sudah diuji untuk mencegah "Glass Wall"?
- [ ] Apakah `IMPLEMENTATION_SUMMARY.md` sudah diupdate dengan status terbaru?
- [ ] Apakah impor dari library blockchain sudah divalidasi versinya?
- [ ] Apakah TIDAK ADA impor `toUtf8Bytes`/`formatBytes32String` dari `viem`?
- [ ] Apakah build lokal (`npm run build`) berhasil tanpa error sebelum push?

## 🚨 Pantangan
- Melakukan modifikasi pada AdminPage tanpa mekanisme error handling.
- Membiarkan file `.env` bocor melalui bundle frontend (Pastikan hanya menggunakan `VITE_` untuk data non-sensitif).
- Mengabaikan pesan error "Token Limit" tanpa menyimpan progres terakhir.
- **Mengimpor fungsi ethers.js (`toUtf8Bytes`, `formatBytes32String`) dari package `viem`.**
- **Push ke Vercel tanpa menjalankan `npm run build` lokal terlebih dahulu.**

---
name: wsl-optimization
description: "Optimizes execution using WSL for high-performance tasks like build and install."
version: v3.63.5-Hardened
---

# 🐧 WSL OPTIMIZATION PROTOCOL (v3.63.5-Hardened)

## 🛡️ ESM RUNTIME RESOLUTION MANDATE (v3.63.5-Hardened)
- **Mandatory Extension**: Seluruh import relatif di dalam direktori `api/` (Serverless Functions) **WAJIB** menggunakan ekstensi `.js` (contoh: `import { data } from './database.js'`).
- **Type Segregation**: Gunakan `import type` untuk seluruh referensi TypeScript guna memastikan *clean stripping* saat runtime.
- **Pre-Fix Audit**: Sebelum melakukan modifikasi arsitektural, jalankan `node scripts/audits/check_sync_status.cjs` untuk memastikan paritas sistem.
- **Parity Verification**: Gunakan endpoint `/api/admin/parity-audit` untuk verifikasi akhir setelah implementasi kode baru.

## 🎯 PURPOSE
Protokol ini dirancang untuk memaksimalkan performa Agen dengan memanfaatkan Windows Subsystem for Linux (WSL) sebagai lingkungan eksekusi utama untuk tugas-tugas berat.

## 🛠️ INFRASTRUCTURE
- **Distro**: Ubuntu (Default)
- **Node Manager**: NVM (v23.6.0)
- **Path Mapping**: `/mnt/e/Disco Gacha/Disco_DailyApp`
- **Helper Script**: `wsl-exec.sh`

## 📜 MANDATORY RULES

### 1. "WSL-First" Execution
Agen WAJIB menggunakan WSL untuk kategori perintah berikut:
- `npm install` / `npm ci`
- `npm run build`
- `npm run dev` / `vite`
- `hardhat compile` / `hardhat test`
- `supabase cli` (Operasi berat)
- `grep_search` pada direktori besar (node_modules dsb)

### 2. Execution Method
Gunakan salah satu metode berikut:
- **Direct**: `wsl bash -c "source ~/.nvm/nvm.sh && nvm use 23.6.0 && <command>"`
- **Helper**: `wsl bash wsl-exec.sh <command>`

### 3. Path Handling
- Selalu konversi path Windows ke format WSL: `e:\path` -> `/mnt/e/path`.
- Gunakan `wsl-run.bat` jika memanggil dari context Windows Explorer.

### 4. Performance Guard
- **Zero Windows Overhead**: Hindari menjalankan `npm install` langsung di PowerShell karena kecepatan I/O di `/mnt/` via Windows sangat lambat dibanding native Linux.
- **Resource Hygiene**: Matikan server di WSL segera setelah verifikasi selesai menggunakan `pkill -f node` atau perintah spesifik.

## 🛡️ VERIFICATION CHECKLIST
- [ ] Perintah dijalankan di WSL?
- [ ] Node version v23.6.0 terdeteksi?
- [ ] Output berhasil diparsing kembali ke Agen?

---
description: Sinkronisasi seluruh environment variables (lokal ke Vercel dan Supabase). Menjalankan script sync-all-envs dan global-sync-env.
aliases: ["/sync-env", "sync env", "sinkronisasi env", "/sinkronisasi-env"]
---

# Environment Variables Sync Workflow

Workflow ini digunakan khusus ketika user meminta untuk mensinkronisasi environment variables (seperti perintah "sync env" atau "sinkronisasi env").

## 📋 Steps to Execute

### 1. Sinkronisasi Lokal
- [ ] Jalankan `node scripts/sync/sync-all-envs.cjs`
- [ ] Jalankan `node scripts/sync/rebuild_abis_data.cjs` (**MANDATORY** for Zero-Hardcode integrity).
- Langkah ini memastikan semua file `.env` turunan memiliki nilai yang sama dan `abis_data.txt` tersinkron dengan placeholder lingkungan.

### 2. Sinkronisasi Global ke Vercel & Supabase
- [ ] Jalankan `node scripts/sync/global-sync-env.js` (Bisa memakan waktu 5-10 menit di background).
- Langkah ini akan melakukan force push untuk semua env variables yang ada di lokal menuju environment Production dan Preview di project Vercel (`crypto-discovery-app` dan `dailyapp-verification-server`).

### 3. Laporan Eksekusi
- [ ] Beritahu user bahwa seluruh environment sudah disinkronisasi sesuai dengan versi `.env` lokal terbaru.

---
// turbo-all
// Workflow Complete

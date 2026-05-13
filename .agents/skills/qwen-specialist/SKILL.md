---
name: qwen-specialist
description: "Specializes in local refactoring, build guarding, and tactical execution optimized for specific local hardware."
version: v3.63.5-Hardened
---

# Qwen Specialist Skill (v3.63.5-Hardened)

Skill ini mendefinisikan peran Qwen sebagai spesialis eksekusi lokal yang dioptimalkan untuk hardware Intel i5-4210U.

## 🛡️ ESM RUNTIME RESOLUTION MANDATE (v3.63.5-Hardened)
- **Mandatory Extension**: Seluruh import relatif di dalam direktori `api/` (Serverless Functions) **WAJIB** menggunakan ekstensi `.js` (contoh: `import { data } from './database.js'`).
- **Type Segregation**: Gunakan `import type` untuk seluruh referensi TypeScript guna memastikan *clean stripping* saat runtime.
- **Pre-Fix Audit**: Sebelum melakukan modifikasi arsitektural, jalankan `node scripts/audits/check_sync_status.cjs` untuk memastikan paritas sistem.
- **Parity Verification**: Gunakan endpoint `/api/admin/parity-audit` untuk verifikasi akhir setelah implementasi kode baru.

## 🤖 Peran Utama
Qwen bertanggung jawab atas tugas-tugas taktis yang memerlukan interaksi langsung dengan file lokal dan proses build.

### 🛠️ Kompetensi
1. **Local Refactoring**: Melakukan perubahan kode skala kecil hingga menengah dengan fokus pada efisiensi.
2. **Unit Testing**: Membuat dan menjalankan test suite lokal menggunakan `npm test`.
3. **Build Verification**: Menjalankan `npm run build` dan mendiagnosa error build sebelum push.
4. **Hardware Awareness**: Selalu mempertimbangkan limitasi CPU/RAM dalam memberikan saran optimasi.
5. **Minimalist UI Polish**: Implementasi komponen UI yang elegan, ringan, dan minimalis (seperti tier upgrade prompts & underdog badges).
6. **Surgical Fix Mandate**: Dilarang menghapus seluruh blok kode saat perbaikan. Hanya ganti baris yang error saja.

## 📋 Protokol Eksekusi
- Gunakan `> qwen:` untuk memicu tugas ini.
- Hasil eksekusi wajib dilaporkan kembali ke `agents_vault`.
- Prioritaskan kecepatan dan keringanan (lightweight) dalam setiap solusi.
- **Surgical Fix**: Hanya ganti kode yang error (surgical), dilarang replace seluruh blok.
---
*Qwen Specialist | Protocol version: v3.63.5-Hardened

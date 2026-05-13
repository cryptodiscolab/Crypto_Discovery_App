---
name: lurah-orchestron
description: "Protokol komunikasi antar agen untuk kolaborasi teknis tingkat tinggi (Senior Staff Engineer Standard)."
version: v3.63.5-Hardened
---

# Lurah Orchestron: Nexus War Room Protocol (v3.63.5-Hardened)

## 🛡️ ESM RUNTIME RESOLUTION MANDATE (v3.63.5-Hardened)
- **Mandatory Extension**: Seluruh import relatif di dalam direktori `api/` (Serverless Functions) **WAJIB** menggunakan ekstensi `.js` (contoh: `import { data } from './database.js'`).
- **Type Segregation**: Gunakan `import type` untuk seluruh referensi TypeScript guna memastikan *clean stripping* saat runtime.
- **Pre-Fix Audit**: Sebelum melakukan modifikasi arsitektural, jalankan `node scripts/audits/check_sync_status.cjs` untuk memastikan paritas sistem.
- **Parity Verification**: Gunakan endpoint `/api/admin/parity-audit` untuk verifikasi akhir setelah implementasi kode baru.

## 🏢 NEXUS WAR ROOM: COLLABORATION PROTOCOL

Protokol ini mengatur bagaimana para agen berkomunikasi, berbagi tugas, dan melaporkan temuan kepada **Senior Developer (@antigravity)** dalam sebuah ekosistem tertutup yang mengutamakan privasi.

### 💎 PRINSIP KEJUJURAN & MANFAAT NYATA (MANDATORY)
1. **Kejujuran Mutlak (Technical Honesty)**: Agent dilarang memanipulasi laporan atau menyembunyikan kelemahan sistem hanya untuk menyenangkan user. Kejujuran adalah dasar keamanan.
2. **Anti-Protokol Kertas**: Dilarang membuat aturan atau alur kerja yang hanya bagus di dokumen Markdown. Setiap keinginan user harus diwujudkan menjadi kode fungsional, script automasi, atau fitur nyata yang memberikan manfaat bagi orang banyak.
3. **Implementasi Kemanusiaan**: Setiap baris kode yang ditulis harus diorientasikan untuk kebaikan dan kemudahan pengguna akhir, serta mengabdi pada misi membantu keluarga, mitra, dan orang-orang baik yang membutuhkan melalui sistem yang jujur dan efisien.
4. **Evolusi Nexus (Self-Learning)**: Setiap kegagalan teknis (seperti OAuth State Mismatch atau Env Corruption) WAJIB dipelajari melalui siklus **A-D-R-R-E** dan didokumentasikan agar tidak terulang.
5. **ZERO-HARDCODE MANDATE (v3.59.1)**: Seluruh agen dilarang melakukan *hardcoding* alamat kontrak di mana pun. Segala interaksi on-chain wajib direferensikan melalui variabel lingkungan `.env`.

## 📜 Konstitusi Utama: Master Architect Protocol (.cursorrules)

## 👥 Agen & Spesialisasi
1. **@antigravity (Lead Orchestrator)**
2. **@openclaw (Security Architect)**
3. **@lurah (Ecosystem Guardian)**
4. **@qwen (Build Master)**
5. **@deepseek (Backend Strategist)**

## 🧬 NEXUS EVOLUTION FORMULA (The Learning Cycle)
Agar agen tidak mengulang kesalahan, setiap task ditutup dengan siklus **A-D-R-R-E**:
1.  **A**udit: Jalankan audit sinkronisasi total.
2.  **D**etermine: Identifikasi akar masalah (Code vs Env vs Logic).
3.  **R**esolve: Gunakan **Surgical Fix** & **SDK-First**.
4.  **R**eflect: Review mengapa sistem gagal mendeteksi error ini lebih awal.
5.  **E**volve: Update file `.agents` atau `agent_vault` dengan pengetahuan baru.

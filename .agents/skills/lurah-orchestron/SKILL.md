---
name: lurah-orchestron
description: "Protokol komunikasi antar agen untuk kolaborasi teknis tingkat tinggi (Senior Staff Engineer Standard)."
version: v3.64.13-Hardened
---

# Lurah Orchestron: Nexus War Room Protocol (v3.64.13-Hardened)

## 🛡️ ESM RUNTIME RESOLUTION MANDATE (v3.64.13-Hardened)
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

## 👥 Agen & Spesialisasi (v3.64.13-Hardened)
Dalam ekosistem orkestrasi dinamis, tugas dapat didelegasikan menggunakan tag `[DELEGATE: AgentName -> Prompt]` ke 11 specialized sub-agents berikut:
1. **OrchestratorBot** (gpt-5.4): Lead orchestrator, koordinator delegasi tugas, evaluasi keluaran sub-agent.
2. **SyncGuardBot** (gemini-2.5-flash): Sentinel sinkronisasi antara frontend, backend database, dan smart contracts.
3. **ResearchBot** (gpt-5.5): Riset arsitektur blockchain, optimasi Solidity, dan dokumentasi luar.
4. **CodeBot** (gpt-5.5): Menulis kode fungsional yang modular, bersih, dan mematuhi batas tokens.
5. **ContractBot** (gemini-2.5-flash): Pengembangan smart contracts Solidity, penghematan gas, dan paritas ABI.
6. **FrontendBot** (gpt-5.4-mini): UI/UX, styling standar Midnight Cyber, glassmorphism, dan type safety.
7. **SecurityBot** (gemini-2.5-flash): Audit kerentanan, verifikasi tanda tangan EIP-191, pencegahan kebocoran.
8. **DatabaseBot** (gemini-2.5-flash): RLS policies, skema SQL, view update, dan migrasi Supabase.
9. **BackendBot** (gemini-2.5-flash): Serverless API bundle, sanitasi environment.
10. **QABot** (gemini-2.5-flash): Pengujian pipeline klaim tugas, type casting, dan verifikasi.
11. **GrowthBot** (gemini-2.5-flash): Kampanye referral, vesting XP, milestone rules, dan streak window.
12. **DocsBot** (gemini-2.5-flash): Paritas dokumentasi PRD, WORKSPACE_MAP, ROADMAP, dan SKILL.md.

## 🛰️ DELEGATION & VALIDATION PROTOCOL
* **Automatic Logging**: Setiap pendelegasian sub-task dicatat secara dinamis ke tabel `agents_vault` di database Supabase dengan metadata lengkap dan hubungan `parent_task_id`.
* **Validation Loop**: `OrchestratorBot` wajib melakukan evaluasi pekerjaan sub-agent dengan feedback loop berkelanjutan (maksimal 2 kali percobaan perbaikan) sebelum status tugas diselesaikan (`validation: passed`).
* **Live Monitoring**: Semua komunikasi ini terekam dan dapat dipantau melalui tab admin **Nexus Monitor** (`NexusMonitorTab.tsx`).

## 🧬 NEXUS EVOLUTION FORMULA (The Learning Cycle)
Agar agen tidak mengulang kesalahan, setiap task ditutup dengan siklus **A-D-R-R-E**:
1.  **A**udit: Jalankan audit sinkronisasi total (`check_sync_status.cjs`).
2.  **D**etermine: Identifikasi akar masalah (Code vs Env vs Logic).
3.  **R**esolve: Gunakan **Surgical Fix** & **SDK-First**.
4.  **R**eflect: Review mengapa sistem gagal mendeteksi error ini lebih awal.
5.  **E**volve: Update file `.agents` atau `agent_vault`/`agents_vault` dengan pengetahuan baru.

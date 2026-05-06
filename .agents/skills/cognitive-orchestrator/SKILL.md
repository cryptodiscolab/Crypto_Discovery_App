---
name: cognitive-orchestrator
description: Mengelola sinkronisasi kognitif lintas agen dan memastikan metodologi skill-creator v0.40.1 diterapkan di seluruh ekosistem.
version: 1.1.0 (v3.59.0 Compatible)
triggers:
  - "sync agents"
  - "cognitive expansion"
  - "shared brain"
  - "multi-agent orchestration"
  - "update docs"
  - "update dokumen"
  - "sync end to end"
  - "sinkronisasi total"
---

# 🧠 COGNITIVE ORCHESTRATOR SKILL

Skill ini adalah pusat pengendalian "Sistem Saraf Terpadu" untuk seluruh agen aktif (Antigravity, OpenClaw, Qwen, DeepSeek).

## 1. Tujuan Utama
Memastikan setiap agen memiliki akses ke memori yang sama (Shared Brain) dan tidak pernah mengulangi kesalahan yang sama (Self-Improving).

## 2. Tier Memori (Hierarki Kognitif)
- **Tier 1 (Core Identity)**: `gemini.md` & `.cursorrules`.
- **Tier 2 (Domain Expertise)**: Folder `.agents/skills/`.
- **Tier 3 (Operational Context)**: `.gemini/context.tmp`.

## 3. Alur Kerja Skill-Creator
Setiap agen yang mengaktifkan skill ini wajib mengikuti alur:
1. **Discovery**: Cari skill relevan di folder `.agents/skills/`.
2. **Ingestion**: Baca `SKILL.md` terpilih secara utuh.
3. **Execution**: Jalankan tugas sesuai mandat skill.
4. **Learning**: Jika ada penemuan baru, update `SKILL.md` atau buat yang baru.

## 4. Anti-Hallucination Guard
- Dilarang menebak status kontrak tanpa memanggil `scripts/audits/check_sync_status.cjs`.
- Dilarang berasumsi tier user tanpa memanggil `get_user_nft_tiers`.
- Dilarang melompati tier sequential (N+1 Mandate).
- **ZERO-HARDCODE LOCK**: Dilarang menggunakan alamat kontrak statis dalam logika pemikiran. Selalu gunakan placeholder lingkungan.

## 5. Ecosystem Documentation Synchronization Mandate
Saat menerima perintah `> update docs` atau `update dokumen`, agen WAJIB:
1. Memverifikasi seluruh file di **Ecosystem Documentation Matrix** (20+ dokumen inti).
2. Memastikan versi PRD, SKILL, dan WORKFLOW selaras dengan status operasional terakhir.
3. Melakukan visual audit terhadap perubahan yang dilakukan guna mencegah penghapusan seksi secara tidak sengaja.

### Ecosystem Documentation Matrix (Core Files):
- **Master Protocols**: `.cursorrules`, `CLAUDE.md`, `.gemini/GEMINI.md`, `DESIGN.md`.
- **Workspace & PRD**: `.agents/WORKSPACE_MAP.md`, `PRD/DISCO_DAILY_MASTER_PRD.md`, `PRD/FEATURE_WORKFLOW_SOT.md`, `PRD/TASK_FEATURE_WORKFLOW.md`, `ROADMAP.md`.
- **Core Skills**: `ecosystem-sentinel`, `secure-infrastructure-manager`, `git-hygiene`, `cognitive-orchestrator`, `xp-reward-lifecycle`, `admin-stability`.
- **Workflows**: `.agents/workflows/nexus-orchestron-loop.md`, `.agents/workflows/sync-env.md`, `.agents/workflows/update-skills.md`, `.agents/workflows/sync-contracts-audit.md`.
- **Infrastructure**: `abis_data.txt`, `.env.example`, `IMPLEMENTATION_SUMMARY.md`.

## 6. End-to-End Ecosystem Synchronization Mandate
Saat menerima perintah `> sync end to end` atau `sinkronisasi total`, agen WAJIB menjalankan alur berikut:
1. **Environment Sync**: Jalankan `node scripts/sync/sync-all-envs.cjs` untuk paritas `.env`.
2. **Contract & ABI Audit**: Jalankan `node scripts/audits/check_sync_status.cjs` (13-point audit).
3. **ABI Rebuild**: Jalankan `node scripts/sync/rebuild_abis_data.cjs` untuk membersihkan hardcode.
4. **Backend/API Parity**: Verifikasi `*-bundle.js` di Vercel Functions agar sinkron dengan database schema terbaru.
5. **XP & Settings Audit**: Verifikasi `point_settings` dan `system_settings` di Supabase.
6. **Frontend UI Audit**: Gunakan `browser_subagent` (jika perlu) untuk memverifikasi tampilan state terbaru.
7. **Documentation Sync**: Jalankan alur `update docs` sebagai langkah final.

---
*Status: ACTIVE. Cognitive Sync: ENABLED. Nexus Matrix 1.0 Ready.*

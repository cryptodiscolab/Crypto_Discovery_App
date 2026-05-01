---
name: cognitive-orchestrator
description: Mengelola sinkronisasi kognitif lintas agen dan memastikan metodologi skill-creator v0.40.1 diterapkan di seluruh ekosistem.
version: 1.0.0
triggers:
  - "sync agents"
  - "cognitive expansion"
  - "shared brain"
  - "multi-agent orchestration"
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
- Dilarang menebak status kontrak tanpa memanggil `check_sync_status.cjs`.
- Dilarang berasumsi tier user tanpa memanggil `get_user_nft_tiers`.
- Dilarang melompati tier sequential (N+1 Mandate).

---
*Status: ACTIVE. Cognitive Sync: ENABLED. Nexus Matrix 1.0 Ready.*

---
name: git-hygiene
description: Protokol untuk menjaga repositori Git tetap bersih dan organized. Skill ini menegakkan Clean Git Tree Mandate dari gemini.md (Section 27) yang melarang file sementara, secrets, dan artefak lainnya masuk ke source control. Berlaku untuk Antigravity dan semua sub-agents.
version: v3.64.22-Hardened
---

## 🛡️ ESM RUNTIME RESOLUTION MANDATE (v3.64.14-Hardened)
- **Mandatory Extension**: Seluruh import relatif di dalam direktori `api/` (Serverless Functions) **WAJIB** menggunakan ekstensi `.js` (contoh: `import { data } from './database.js'`).
- **Type Segregation**: Gunakan `import type` untuk seluruh referensi TypeScript guna memastikan *clean stripping* saat runtime.
- **Pre-Fix Audit**: Sebelum melakukan modifikasi arsitektural, jalankan `node scripts/audits/check_sync_status.cjs` untuk memastikan paritas sistem.
- **Parity Verification**: Gunakan endpoint `/api/admin/parity-audit` untuk verifikasi akhir setelah implementasi kode baru.

# 🌿 Git Hygiene & Clean Tree Manager

**Tujuan:** Menjaga repositori Git tetap bersih — hanya berisi *source code*, *config*, dan *deployment scripts*. File sementara, *secrets*, dan artefak build tidak boleh tercampur.

---

## 1. Prinsip Dasar (Clean Tree Mandate)

Git adalah **Single Source of Truth** untuk kode sumber. Polutan berikut ini **DILARANG** masuk ke repository:

### ❌ NEVER COMMIT (Selalu di .gitignore)
| File / Pola | Alasan |
|---|---|
| `.env`, `.env.local`, `.env.vercel*` | Secrets — BAHAYA MUTLAK |
| `vite.config.js.timestamp-*.mjs` | Vite build artifacts — CLEAN ON SIGHT |
| `tmp_*.cjs`, `tmp_*.js`, `tmp_*.mjs` | Scratch scripts sementara, hapus setelah dipakai |
| `FlatCryptoDisco*.sol` | Generated files — rebuild via `npx hardhat flatten` |
| `_archive/` | Kode lama / legacy |
| `scripts/audits/env-comparison-report-*.txt` | Output laporan otomatis CI |
| `tsc_output*.txt`, `lint_results*.txt` | Build/Lint artifacts — CLEAN ON SIGHT (v3.63.5-Hardened) |
| `test-env/` | Data environment test lokal |
| `*.log`, `*.tmp`, `*.scratch.*` | Log & file sementara |
| `*.png`, `*.jpg`, `*.webp`, `*.gif`, `*.mp4` | Screenshot & media — DILARANG MUTLAK |
| `*.pem`, `*.key`, `*.p12`, `*.cert` | Certificates & Private Keys — DILARANG MUTLAK |
| `backups/` | **DB backup dumps — berisi PII user — TIDAK BOLEH PERNAH di-commit!** |
| `node_modules/`, `dist/`, `artifacts/`, `cache/` | Dependencies & build output |

### ✅ ALWAYS TRACK (Wajib masuk Git)
| File / Folder | Alasan |
|---|---|
| `contracts/` | Smart contracts aktif |
| `api/` | Vercel serverless functions |
| `src/` | Frontend source code |
| `scripts/` | Operational scripts (verify, sync) |
| `PRD/*.html` | PRD Documentation (HTML Version) |
| `.agents/skills/` | Skill definitions & protocols |
| `.cursorrules` | Sudah ada di .gitignore — TRACKING via agent protocol only |
| `.gitleaks.toml` | Security scan config |
| `.gitignore` | Hygiene config itu sendiri |
| `.husky/` | Git hooks |
| `hardhat.config.cjs`, `package.json` | Build configs |

### 🔍 Surgical Fix Mandate (ANTI-DESTRUCTION)
- **DILARANG KERAS** menghapus seluruh kode saat perbaikan. Hanya ganti baris yang error saja (Surgical Fix) untuk menjaga riwayat git tetap bersih dan logis.

---

## 2. Pre-Push Git Status Protocol

Sebelum setiap `git push`, agent WAJIB menjalankan:

```bash
git status
```

Jika ada file yang tidak dikenali atau tidak seharusnya ada:
1. Periksa apakah file tersebut sudah ada di `.gitignore`.
2. Jika belum ada di `.gitignore`, tambahkan pola yang sesuai.
3. Jalankan `git rm --cached <file>` untuk menghapus file dari staging tanpa menghapusnya secara fisik.

---

## 3. Scratch File Lifecycle Protocol

File sementara (scratch scripts) memiliki siklus hidup yang jelas:

```
[BUAT] tmp_check_xyz.cjs → [PAKAI] Jalankan → [SELESAI] → [HAPUS]
```

- **Buat**: Awali nama dengan `tmp_` agar otomatis masuk `.gitignore`.
- **Pakai**: Eksekusi, baca hasilnya.
- **Hapus**: Setelah tujuan tercapai, hapus file tersebut dengan `rm tmp_check_xyz.cjs`.
- **DILARANG**: Membiarkan file `tmp_*` bertahan di direktori root lebih dari 1 sesi kerja.

---

## 4. Automated Hygiene Commands

> On this Windows workspace, prefer the local RTK binary form `.\.bin\rtk.exe ...` for token-heavy git/read/grep/npm/npx commands. Do not assume bare `rtk` is on PowerShell `PATH`; verify with `.\.bin\rtk.exe --version`.

```bash
# Cek status repositori sebelum push
.\.bin\rtk.exe git status

# Hapus file dari staging (tanpa menghapus file fisik)
git rm --cached <nama-file>

# Hapus file sementara yang sudah tidak diperlukan
Remove-Item tmp_*.cjs, tmp_*.js, tsc_output*.txt, lint_results*.txt

# Check berapa file yang sedang di-track tapi seharusnya di-ignore
.\.bin\rtk.exe git ls-files --others --exclude-standard
```

---

## 5. Git Pre-Commit Hook (Anti-Negligence & RTK Guard) (v3.64.14-Hardened)

Repositori ini dikonfigurasi dengan Git hook `pre-commit` (melalui Husky) yang berjalan otomatis sebelum komit dibuat. Hook ini mengeksekusi pemeriksaan berikut:
0. **Strict Git Flow Guard** (`node scripts/audits/git_flow_guard.cjs`)
   - Memblokir commit langsung dari `main`, `master`, dan `develop`.
   - Memblokir branch yang tidak mengikuti `feature/nama-fitur` atau `bugfix/123-short-description`.
   - Menjamin semua perubahan masuk ke `develop`/`main` via Pull Request.
1. **Agent Anti-Negligence Hook** (`node scripts/audits/agent_anti_negligence_hook.cjs`)
   - Mendeteksi kebocoran log `[dotenv]`.
   - Memeriksa file polutan/sampah di direktori kerja (Git Hygiene).
   - Memastikan paritas Peta Kerja (`.agents/WORKSPACE_MAP.md`).
   - Melakukan audit keamanan (Secret Leak Audit).
   - Memastikan ketersediaan dan validitas **Rust Token Killer (RTK)** di `.bin/rtk.exe`.
2. **Gitleaks Scan** (`npm run gitleaks-check`)
   - Memeriksa kebocoran token, private key, dan data sensitif secara statis.

> 🚨 **PENTING**: Komit akan secara otomatis diblokir jika salah satu pemeriksaan di atas gagal, atau jika executable **RTK** (`.bin/rtk.exe`) tidak terdeteksi atau tidak aktif di workspace.

## 5.1 Strict Git Flow & PR Mandate (v3.65.0)

Semua agent dan tim WAJIB mengikuti strategi berikut:

- **No direct commit** ke `main`, `master`, atau `develop`.
- **Branching strategy**: gunakan `feature/nama-fitur` untuk fitur dan `bugfix/123-short-description` untuk bug.
- **Pre-code tests**: sebelum menulis kode baru, jalankan `npm run test:all` untuk baseline.
- **Regression tests**: jika perubahan mempengaruhi fungsi, hook, API route, contract, atau UI flow lain, tambah/update test yang mencakup dependensi tersebut.
- **PR review**: merge ke `develop` atau `main` wajib melalui PR dengan peer review atau AI code review.
- **Required checks**: PR tidak boleh merge jika `Strict Git Flow / Required Tests` atau check wajib lain belum pass.

Enforcement:

```bash
npm run git-flow:guard
npm run test:all
```

GitHub settings wajib mengikuti `.github/BRANCH_PROTECTION_RULES.md`.

---

## 6. Penanggung Jawab

Skill ini WAJIB dipahami dan diterapkan oleh **semua 12 agents**:
- **Antigravity / OrchestratorBot** — Lead agent, bertanggung jawab atas state akhir `.gitignore` dan pengawasan pipeline.
- **SecurityBot** — Security audit, termasuk mencari secrets yang tidak sengaja tertrack.
- **CodeBot / FrontendBot / ContractBot** — Sub-agents harus menghapus file sementara (seperti `tsc-errors*.txt`, scratch files, dll) setelah selesai.

---

---

## ⚠️ Lessons Learned (v3.64.22-Hardened)

### Transaction Hash vs Private Key Pattern
Anti-negligence hook menggunakan regex `/[0-9a-fA-F]{64}/` yang akan mendeteksi tx hash (64 hex chars) sebagai private key. **Solusi**: Abbreviated form `0x40d5804...65ba78f2` bukan full hash.

### `vercel env add` — 1 environment per call
Vercel CLI tidak mendukung `vercel env add KEY production preview development` sekaligus. Harus dipanggil terpisah per environment. Gunakan `scripts/sync/update_vercel_contracts.cjs` yang sudah handle ini.

### `backups/` WAJIB di .gitignore
DB backup dumps (`backups/`) berisi PII user — tidak boleh pernah di-commit. Pastikan selalu ada di `.gitignore` sebelum membuat backup system.

---

*Protokol ini adalah bagian dari gemini.md Section 27: CLEAN GIT TREE MANDATE. Sync with PRD v3.64.22-Hardened.*

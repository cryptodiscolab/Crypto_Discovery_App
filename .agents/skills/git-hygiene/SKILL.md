---
name: Git Hygiene & Clean Tree Manager
description: Protokol untuk menjaga repositori Git tetap bersih dan organized. Skill ini menegakkan Clean Git Tree Mandate dari gemini.md (Section 27) yang melarang file sementara, secrets, dan artefak lainnya masuk ke source control. Berlaku untuk Antigravity dan semua sub-agents.
---

# 🌿 Git Hygiene & Clean Tree Manager

**Tujuan:** Menjaga repositori Git tetap bersih — hanya berisi *source code*, *config*, dan *deployment scripts*. File sementara, *secrets*, dan artefak build tidak boleh tercampur.

---

## 1. Prinsip Dasar (Clean Tree Mandate)

Git adalah **Single Source of Truth** untuk kode sumber. Polutan berikut ini **DILARANG** masuk ke repository:

### ❌ NEVER COMMIT (Selalu di .gitignore)
| File / Pola | Alasan |
|---|---|
| `.env`, `.env.local`, `.env.vercel*` | Secrets — BAHAYA MUTLAK |
| `tmp_*.cjs`, `tmp_*.js`, `tmp_*.mjs` | Scratch scripts sementara, hapus setelah dipakai |
| `FlatCryptoDisco*.sol` | Generated files — rebuild via `npx hardhat flatten` |
| `_archive/` | Kode lama / legacy |
| `scripts/env-comparison-report-*.txt` | Output laporan otomatis CI |
| `test-env/` | Data environment test lokal |
| `*.log`, `*.tmp`, `*.scratch.*` | Log & file sementara |
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

```bash
# Cek status repositori sebelum push
git status

# Hapus file dari staging (tanpa menghapus file fisik)
git rm --cached <nama-file>

# Hapus file sementara yang sudah tidak diperlukan
Remove-Item tmp_*.cjs, tmp_*.js

# Check berapa file yang sedang di-track tapi seharusnya di-ignore
git ls-files --others --exclude-standard | head -30
```

---

## 5. Penanggung Jawab

Skill ini WAJIB dipahami dan diterapkan oleh **semua agents**:
- **Antigravity** — Lead agent, bertanggung jawab atas state akhir `.gitignore`.
- **OpenClaw** — Security audit, termasuk mencari secrets yang tidak sengaja tertrack.
- **Qwen / DeepSeek** — Sub-agents harus menghapus file sementara setelah selesai.

---

*Protokol ini adalah bagian dari gemini.md Section 27: CLEAN GIT TREE MANDATE.*

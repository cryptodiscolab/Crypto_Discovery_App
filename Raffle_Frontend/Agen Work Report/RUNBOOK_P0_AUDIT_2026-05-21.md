# RUNBOOK P0 AUDIT 2026-05-21

- **Workspace:** `E:\Disco Gacha\Disco_DailyApp`
- **Scope:** P0 audit dan manual proof untuk flow wallet, SBT entitlement, pending sync recovery, dan social verifier
- **Status:** Ready for execution
- **Primary Source:** [AGEN_WORK_REPORT.md](file:///Raffle_Frontend/Agen%20Work%20Report/AGEN_WORK_REPORT.md)

---

## 1. Goal

Runbook ini dipakai untuk menutup gap audit yang masih tersisa pada flow berisiko tinggi. Output akhirnya bukan opini, tetapi bukti:

1. `PASS` / `FAIL` per flow
2. `tx_hash` untuk flow on-chain
3. response API yang relevan
4. row DB yang berubah
5. state UI akhir
6. catatan error bila ada

---

## 2. Owners

| Owner | Tanggung Jawab |
|---|---|
| QA / Frontend / Web3 | Menjalankan browser E2E, capture UI, tx hash, network log |
| Contract / Ops | Memastikan verifier, role, env, dan contract address live sudah benar |
| Backend / DB | Memverifikasi voucher API, sync API, pending recovery, dan DB evidence |
| Verifier / Social | Menjalankan fixture test Farcaster dan X |

---

## 3. Preflight

Sebelum audit flow dimulai, semua item ini harus hijau:

- [ ] Frontend build production pass
- [ ] Preview atau deployment target bisa dibuka
- [ ] Wallet testnet siap dan punya saldo untuk gas
- [ ] Environment target memakai contract address yang benar
- [ ] `SBT_MINT_ENTITLEMENT_VERIFIER_ADDRESS` sudah di-set jika jalur entitlement diuji
- [ ] Admin/test wallet yang dibutuhkan tersedia

Evidence wajib:

- Screenshot halaman target
- Current contract address yang dipakai frontend
- Chain ID target

---

## 4. Contract / Ops Runbook

### 4.1 Verifier Wiring

Checklist:

- [ ] Confirm live `DailyAppV15` address yang dipakai frontend
- [ ] Confirm live verifier address
- [ ] Confirm deployed ABI expose `mintNFTWithEntitlement`
- [ ] Call `DailyAppV15.setSBTMintEntitlementVerifier(verifier)` jika belum
- [ ] Grant `CONSUMER_ROLE` pada verifier ke `DailyAppV15`
- [ ] Grant `ENTITLEMENT_SIGNER_ROLE` pada verifier ke wallet signer backend

Evidence wajib:

- Contract address `DailyAppV15`
- Contract address `SBTMintEntitlementVerifier`
- Tx hash untuk setter verifier
- Tx hash untuk role grant
- Screenshot / log selector parity bila dijalankan

Exit criteria:

- Frontend dan backend menunjuk ke contract yang sama
- Verifier live bisa dipakai oleh `DailyAppV15`

### 4.2 MasterX Follow-Up

Checklist:

- [ ] Setelah satu SBT upgrade sukses, cek apakah MasterX tier ikut berubah
- [ ] Jika tidak auto-sync, catat sebagai deferred behavior dan siapkan batch sync manual

Evidence wajib:

- Wallet address yang diuji
- Tier sebelum dan sesudah di DailyApp
- Tier sebelum dan sesudah di MasterX

Exit criteria:

- Auto-sync proven, atau waiver tertulis dibuat

---

## 5. Backend / DB Runbook

### 5.1 SBT Entitlement API

Endpoint:

- `/api/user-bundle?action=sbt-mint-entitlement`

Checklist:

- [ ] Request valid menghasilkan voucher signed
- [ ] Wrong wallet ditolak
- [ ] Expired / stale voucher ditolak
- [ ] Reused nonce ditolak
- [ ] Wrong tier order ditolak

Evidence wajib:

- Request body contoh
- Response body sukses
- Response body gagal untuk minimal 2 negative cases

Exit criteria:

- Voucher signing dan validation path terbukti bekerja

### 5.2 Post-Mint Sync

Endpoint:

- `/api/user-bundle?action=sync-sbt-upgrade`

Checklist:

- [ ] Setelah mint sukses, backend sync sukses
- [ ] Activity log tertulis
- [ ] Tier DB ter-update
- [ ] Jika sync gagal, pending recovery tercatat

Evidence wajib:

- API response
- `user_profiles` before/after
- `user_activity_logs` row
- `pending_sync_jobs` row jika disimulasikan gagal

Exit criteria:

- Tidak ada mint sukses yang hilang dari DB/log

### 5.3 Pending Recovery

Checklist:

- [ ] Simulasikan minimal satu failure-path
- [ ] Pastikan row `pending_sync_jobs` dibuat
- [ ] Jalankan / tunggu cron reconciliation
- [ ] Pastikan row pending terselesaikan atau status berubah sesuai hasil

Evidence wajib:

- Pending job row
- Status sebelum dan sesudah reconcile
- Log reconcile yang relevan

Exit criteria:

- Failure-path tidak diam-diam hilang

---

## 6. QA / Frontend / Web3 Runbook

### 6.1 Required High-Risk Flow Checklist

Semua flow ini wajib diuji:

- [ ] Connect wallet / SIWE login
- [ ] Create sponsorship raffle
- [ ] Reject raffle dengan `cancelRaffle`
- [ ] Campaign join
- [ ] Daily claim
- [ ] SBT upgrade via entitlement
- [ ] Admin contract config write
- [ ] Pending sync recovery UI
- [ ] Notification flow

### 6.2 Per-Flow Evidence Template

Setiap flow harus mengisi template ini:

| Field | Isi |
|---|---|
| Flow name | |
| Wallet used | |
| Network / chain ID | |
| Start time | |
| Tx hash | |
| API endpoint(s) hit | |
| API response summary | |
| DB row changed | |
| Final UI state | |
| Console errors | |
| PASS / FAIL | |

### 6.3 Special Notes For SBT Upgrade

Tambahan wajib untuk flow `SBT upgrade via entitlement`:

- [ ] Capture entitlement request
- [ ] Capture signed voucher response
- [ ] Capture mint tx hash
- [ ] Capture final tier in UI
- [ ] Capture final tier in DB
- [ ] Capture final tier in MasterX jika auto-sync aktif

### 6.4 Failure-Path Drill

Minimal sekali lakukan simulasi:

- backend sync gagal setelah tx chain sukses

Yang harus terlihat:

- [ ] UI memberi state recoverable / pending
- [ ] `pending_sync_jobs` row tercatat
- [ ] Reconcile kemudian menyelesaikan pending tersebut

---

## 7. Verifier / Social Runbook

### 7.1 Farcaster

- [ ] Pilih satu akun fixture
- [ ] Jalankan satu task verifikasi penuh
- [ ] Capture hasil verifier dan state task

### 7.2 X / Twitter

- [ ] Pilih satu akun fixture
- [ ] Jalankan satu task verifikasi penuh
- [ ] Capture hasil verifier dan state task

Evidence wajib:

- Task ID
- Wallet
- Response verifier
- Final state di UI / DB

Exit criteria:

- Minimal satu Farcaster dan satu X path terbukti sehat, atau ditulis out-of-scope dengan waiver

---

## 8. Daily Execution Order

### Day 0 - Setup

1. Confirm env, address, verifier wiring, wallet funding
2. Confirm preview / target deployment
3. Prepare DB access untuk evidence

### Day 1 - Core Wallet Flows

1. Connect wallet / SIWE login
2. Campaign join
3. Daily claim
4. Sponsorship raffle create

### Day 2 - SBT + Admin

1. SBT entitlement request
2. SBT upgrade via entitlement
3. Verify MasterX auto-sync
4. Admin contract config write

### Day 3 - Failure Paths + Social

1. Pending sync recovery failure drill
2. Notification flow
3. Farcaster verifier test
4. X verifier test

---

## 9. Final Exit Criteria

Runbook ini dianggap selesai hanya jika:

- [ ] Semua flow punya status `PASS` atau `FAIL`
- [ ] Semua flow on-chain punya `tx_hash`
- [ ] Semua sync penting punya bukti API + DB
- [ ] `mintNFTWithEntitlement` terbukti pada deployed environment
- [ ] MasterX auto-sync setelah SBT upgrade terbukti atau di-waive tertulis
- [ ] Pending sync recovery terbukti dari failure-path nyata
- [ ] Social verifier path terbukti atau di-waive tertulis

---

## 10. Output Artifact Checklist

Setelah runbook selesai, hasil harus disimpan sebagai:

- [ ] Summary PASS/FAIL per flow
- [ ] Kumpulan tx hash
- [ ] Kumpulan API response penting
- [ ] Kumpulan screenshot UI
- [ ] Kumpulan query/result DB before-after
- [ ] Waiver tertulis untuk item yang tidak diuji

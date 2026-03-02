# 🔍 Supabase Security & Integrity Checklist

Gunakan checklist ini setiap kali melakukan migrasi database (file `.sql`) atau perubahan pada logika data.

## 1. Keamanan RLS (Row Level Security)
- [ ] Apakah RLS sudah diaktifkan? (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`)
- [ ] Apakah kebijakan `SELECT` sudah tepat? (Publik vs Privat)
- [ ] Apakah kebijakan `INSERT/UPDATE` dilarang untuk peran `anon`?
- [ ] Apakah hanya `SERVICE_ROLE` yang memiliki akses tulis pada tabel sensitif?
- [ ] Apakah ada fungsi `is_admin_wallet()` yang memproteksi tabel konfigurasi?

## 2. Integritas Data Web3
- [ ] Apakah `wallet_address` dipaksa lowercase di level DB? (`CHECK constraint`)
- [ ] Apakah tipe data `fid` menggunakan `BIGINT` untuk Farcaster ID?
- [ ] Apakah ada `UNIQUE INDEX` untuk mencegah duplikasi klaim harian?
- [ ] Apakah `created_at` menggunakan `DEFAULT NOW()`?

## 3. Logika & Sinkronisasi
- [ ] Apakah fungsi trigger `sync_user_xp` sudah terpasang di tabel klaim?
- [ ] Jika ada kolom baru, apakah sudah disertakan dalam index jika sering difilter?
- [ ] Apakah fungsi `get_user_stats` sinkron dengan struktur profil terbaru?
- [ ] Apakah pembulatan `trust_score` atau `reward_per_share` sudah menggunakan presisi yang benar (`1e18`)?

## 4. Standar Backend (Zero Trust)
- [ ] Apakah semua mutasi data melalui API Route (`/api/...`)?
- [ ] Apakah API Route melakukan verifikasi tanda tangan (`viem.verifyMessage`)?
- [ ] Apakah `SERVICE_ROLE_KEY` aman dan tidak bocor ke frontend?

---
*Checklist ini wajib diikuti sesuai Rule 8 di .cursorrules.*

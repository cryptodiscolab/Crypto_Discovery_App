# 🧪 Disco Daily /test-env

Direktori ini digunakan khusus untuk pengembangan, perbaikan bug, dan pengujian fitur baru di jaringan **Base Sepolia Testnet**.

## 🚀 Aturan Pakai
1.  **Isolasi**: Jangan pernah mengimpor file konfigurasi dari root `.env` ke dalam pengujian di sini. Gunakan `.env.test` di folder ini.
2.  **Verify First**: Setiap fitur baru WAJIB lolos uji coba di sini sebelum kodenya dipindahkan ke folder produksi utama.
3.  **No Real Funds**: Pastikan akun yang digunakan di sini hanya memiliki ETH Sepolia (Faucet).

## 📁 Struktur
- `.env.test`: Konfigurasi khusus Sepolia.
- `scripts/`: Tempat menaruh script pengujian fitur (misal: `test-claim.cjs`).
- `logs/`: Hasil audit pengujian.

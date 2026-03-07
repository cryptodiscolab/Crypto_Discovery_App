@echo off
TITLE Crypto Discovery - Super Launcher
COLOR 0E

echo [1/3] Navigating to Frontend...
cd /d "%~dp0Raffle_Frontend"

echo [2/3] Starting App Engine in background...
:: Kita jalankan npm run dev di jendela baru
start "Disco-App-Engine" cmd /k "echo 🤖 MESIN SEDANG BERJALAN... & echo JANGAN TUTUP JENDELA INI! & echo. & npm run dev"

echo.
echo [3/3] Menunggu mesin panas (10 detik)...
timeout /t 10

echo.
echo [OK] Membuka Admin Dashboard di browser...
start http://localhost:5173/admin

echo.
echo ==========================================
echo    APP SUDAH SELESAI DIJALANKAN!
echo ==========================================
echo JANGAN TUTUP jendela hitam yang baru terbuka.
echo Jika browser tidak terbuka otomatis, buka manual:
echo http://localhost:5173/admin
echo.
pause

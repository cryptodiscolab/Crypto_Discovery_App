@echo off
TITLE Crypto Discovery - Super Launcher (Ultra Fast)
COLOR 0E

echo ===================================================
echo    CRYPTO DISCO - HYPER STARTUP
echo ===================================================
echo.

echo [1/4] Navigating to Frontend...
cd /d "%~dp0Raffle_Frontend"

echo [2/4] Starting App Engine (Vite) in background...
start "Disco-App-Engine" cmd /k "echo 🤖 MESIN FRONTEND SEDANG BERJALAN... & echo JANGAN TUTUP JENDELA INI! & echo. & npm run dev"

echo.
echo [!] Stabilizing...
timeout /t 2 > nul

echo [3/4] Starting Nexus Qwen Worker (Local Agent)...
cd /d "%~dp0"
start "Disco-Nexus-Worker" cmd /k "echo 🧠 AGENT QWEN SEDANG BERPATROLI... & echo JANGAN TUTUP JENDELA INI! & echo. & node .agents/scripts/qwen-worker.js"

echo.
echo [4/4] Opening Dashboard...
echo Dashboard akan terbuka dalam 2 detik.
timeout /t 2

echo.
echo [OK] Launching Browser...
start http://localhost:5173/admin

echo.
echo ==========================================
echo    EKOSISTEM DISCO SUDAH AKTIF!
echo ==========================================
echo JANGAN TUTUP JENDELA HITAM!
echo.
echo NOTE: Jika halaman /admin terlihat KOSONG (Blank), 
echo silakan TEKAN F5 atau REFRESH di browser Anda.
echo Hal ini normal jika Vite sedang memproses update kode baru.
echo.
pause

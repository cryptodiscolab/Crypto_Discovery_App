@echo off
setlocal enabledelayedexpansion
:: Generate a unique session ID for this launch to avoid killing other unrelated node processes
set SESSION_ID=DISCO_SESSION_%RANDOM%
TITLE Crypto Discovery - Lead Orchestrator [%SESSION_ID%]
COLOR 0E

echo ===================================================
echo    CRYPTO DISCO - HYPER STARTUP (Dynamic)
echo    Session ID: %SESSION_ID%
echo ===================================================
echo.

:: --- STEP 0: STARTUP GUARD ---
echo [0/4] Running Pre-flight Audit...

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js tidak ditemukan! Silakan install Node.js v18+.
    pause
    exit /b
)

:: Resolve Ports from .env (Zero-Hardcode Mandate + Auto-Search)
for /f "tokens=*" %%i in ('node "%~dp0scripts\utils\resolve-ports.cjs"') do %%i

if "%DISCO_FE_PORT%"=="" set DISCO_FE_PORT=5173
if "%DISCO_BE_PORT%"=="" set DISCO_BE_PORT=3000

echo [OK] Ports Resolved: FE:%DISCO_FE_PORT% | BE:%DISCO_BE_PORT%

:: --- STEP 1: FRONTEND CHECK ---
echo [1/4] Checking Frontend...
if not exist "%~dp0Raffle_Frontend\node_modules\" (
    echo [WARN] node_modules frontend tidak ditemukan.
    echo Menjalankan npm install...
    cd /d "%~dp0Raffle_Frontend" && npm install
)

:: --- STEP 2: LAUNCH ENGINES ---
echo [2/4] Starting App Engine (Vite) on port %DISCO_FE_PORT%...
set VITE_BACKEND_PORT=%DISCO_BE_PORT%
:: Use the Session ID in the Title for cleanup later
start "%SESSION_ID%_FE" cmd /k "cd /d \"%~dp0Raffle_Frontend\" & set VITE_BACKEND_PORT=%DISCO_BE_PORT% & echo 🤖 MESIN FRONTEND SEDANG BERJALAN... & npm run dev"

echo [3/4] Starting Verification Node (Backend) on port %DISCO_BE_PORT%...
start "%SESSION_ID%_BE" cmd /k "cd /d \"%~dp0verification-server\" & set PORT=%DISCO_BE_PORT% & echo 🛡️ VERIFICATION NODE SEDANG BERJALAN... & npm run dev"

echo.
echo [!] Stabilizing ecosystem...
timeout /t 3 > nul

:: --- STEP 4: BROWSER ---
echo [4/4] Opening Dashboard...
start http://localhost:%DISCO_FE_PORT%/admin

echo.
echo ===================================================
echo    EKOSISTEM DISCO SUDAH AKTIF!
echo ===================================================
echo JANGAN TUTUP JENDELA INI KECUALI INGIN BERHENTI.
echo.
echo [TEKAN TOMBOL APA SAJA UNTUK MEMATIKAN SEMUA SERVER]
echo.
pause

:: --- CLEANUP ON EXIT ---
echo.
echo [!] Sedang mematikan seluruh server (Cleanup)...
taskkill /F /FI "WINDOWTITLE eq %SESSION_ID%_FE*" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq %SESSION_ID%_BE*" /T >nul 2>&1

echo [OK] Seluruh server telah ditutup.
echo Sampai jumpa, Agent!
timeout /t 2 > nul
exit

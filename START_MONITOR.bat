@echo off
setlocal enabledelayedexpansion
set SESSION_ID=MONITOR_SESSION_%RANDOM%
TITLE Nexus Monitor - Orchestrator [%SESSION_ID%]
COLOR 0B

echo ===================================================
echo    NEXUS MONITOR - STARTUP (Dynamic)
echo    Session ID: %SESSION_ID%
echo ===================================================
echo.

:: --- STARTUP GUARD ---
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js tidak ditemukan!
    pause
    exit /b
)

:: Resolve Ports
for /f "tokens=*" %%i in ('node "%~dp0scripts\utils\resolve-ports.cjs"') do %%i
if "%DISCO_MONITOR_PORT%"=="" set DISCO_MONITOR_PORT=4000

echo [OK] Monitor Port Resolved: %DISCO_MONITOR_PORT%

:: --- LAUNCH ---
echo Launching Nexus Monitor Local Server...
set MONITOR_PORT=%DISCO_MONITOR_PORT%
:: Launch in a separate window but with unique title for cleanup
start "%SESSION_ID%_SRV" cmd /c "set MONITOR_PORT=%DISCO_MONITOR_PORT% & node \"%~dp0scripts\debug\monitor-server.cjs\""

timeout /t 2 /nobreak > nul
echo Opening browser...
start http://localhost:%DISCO_MONITOR_PORT%

echo.
echo ===================================================
echo   NEXUS MONITOR IS LIVE AT http://localhost:%DISCO_MONITOR_PORT%
echo ===================================================
echo JANGAN TUTUP JENDELA INI KECUALI INGIN BERHENTI.
echo.
echo [TEKAN TOMBOL APA SAJA UNTUK MEMATIKAN MONITOR]
echo.
pause

:: --- CLEANUP ---
echo.
echo [!] Sedang mematikan monitor (Cleanup)...
taskkill /F /FI "WINDOWTITLE eq %SESSION_ID%_SRV*" /T >nul 2>&1

echo [OK] Monitor telah ditutup.
timeout /t 2 > nul
exit

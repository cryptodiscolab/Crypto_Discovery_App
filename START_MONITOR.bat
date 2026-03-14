@echo off
setlocal
cd /d "%~dp0"
title Nexus Monitor Launcher

echo Launching Nexus Monitor Local Server...
start /b node scripts/debug/monitor-server.cjs

timeout /t 2 /nobreak > nul
echo Opening browser...
start http://localhost:4000

echo.
echo ===================================================
echo   NEXUS MONITOR IS LIVE AT http://localhost:4000
echo ===================================================
echo Keep this window open while monitoring.
echo To stop, close this window or press Ctrl+C.
echo.
pause

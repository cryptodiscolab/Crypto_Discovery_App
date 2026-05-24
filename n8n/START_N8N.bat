@echo off
title Disco n8n (Lightweight)
cd /d "%~dp0"

echo ==========================================
echo  Disco DailyApp - n8n Workflow Engine
echo  Self-hosted (FREE - Low Resource Mode)
echo ==========================================
echo.

:: Create data directory if missing
if not exist n8n_data mkdir n8n_data

:: Load env vars from .env file
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if not "%%a"=="" if not "%%a"=="#" (
        set %%a=%%b
    )
)

:: Lightweight mode - minimal resource usage
set N8N_PORT=5678
set N8N_PROTOCOL=http
set N8N_HOST=localhost
set WEBHOOK_URL=http://localhost:5678/
set N8N_ENCRYPTION_KEY=disco-dev-encryption-key-2026

:: === PERFORMANCE TUNING (Laptop Friendly) ===
set EXECUTIONS_DATA_PRUNE=true
set EXECUTIONS_DATA_MAX_AGE=72           :: Hapus history >72 jam (default 168)
set EXECUTIONS_DATA_PRUNE_TIMEOUT=1       :: Prune cepet biar ga numpuk
set N8N_PAYLOAD_SIZE_MAX=1                :: Batasi payload 1MB (default 16)
set N8N_METRICS=false                     :: Matiin metrics (hemat CPU)
set N8N_METRICS_INCLUDE_DEFAULT_METRICS=false
set N8N_SKIP_WEBHOOK_DEREGISTRATION_NOTIFICATION=true
set N8N_DISABLE_PRODUCTION_MAIN_PROCESS=false
set N8N_CONCURRENCY_PRODUCTION_LIMIT=1    :: Max 1 job at a time
set N8N_POLLING_INTERVAL=60               :: Poll setiap 60 detik (default 30)
set N8N_REALTIME_UPDATES=false            :: Matiin realtime UI updates
set N8N_HIRING_BANNER_ENABLED=false       :: Matiin banner
set N8N_VERSION_NOTIFICATIONS_ENABLED=false :: Matiin version check

echo [INFO] Starting n8n in LOW RESOURCE mode...
echo [INFO] Open http://localhost:5678
echo [INFO] Estimated RAM: ~150-200MB | CPU: Low
echo [INFO] Press Ctrl+C to stop
echo.

npx n8n start
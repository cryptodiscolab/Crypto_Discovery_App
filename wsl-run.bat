@echo off
setlocal
set PROJECT_DIR=%~dp0
set WSL_PATH=%PROJECT_DIR:\=/%
set WSL_PATH=/mnt/%WSL_PATH:C:=c%
set WSL_PATH=%WSL_PATH:D:=d%
set WSL_PATH=%WSL_PATH:E:=e%

wsl bash "/mnt/e/Disco Gacha/Disco_DailyApp/wsl-exec.sh" %*

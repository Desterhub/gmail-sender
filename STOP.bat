@echo off
title Gmail Bulk Sender - Stopping Servers
cd /d "%~dp0"
chcp 65001 >nul

cls
echo =====================================================================
echo           GMAIL BULK SENDER - STOPPING ALL SERVERS                   
echo =====================================================================
echo.
echo [*] Terminating active processes on ports 3000 and 5173...

set /a KILLED=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
    set /a KILLED+=1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
    set /a KILLED+=1
)

echo [OK] All Gmail Bulk Sender servers have been shut down cleanly.
echo.
ping 127.0.0.1 -n 3 >nul
exit /b 0

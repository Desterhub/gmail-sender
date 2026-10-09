@echo off
title Gmail Bulk Sender - Live Server
cd /d "%~dp0"
chcp 65001 >nul

cls
echo =====================================================================
echo           GMAIL BULK SENDER - AUTOMATIC LIVE SYSTEM                  
echo =====================================================================
echo.

:: 1. Setup Node.js Path (Bundled portable Node or System Node)
if exist "%~dp0.node22\node-v22.14.0-win-x64\node.exe" (
    set "PATH=%~dp0.node22\node-v22.14.0-win-x64;%PATH%"
)
set "PATH=%PATH%;C:\Program Files\nodejs"

:: 2. Verify Node is available
where node >nul 2>nul
if %ERRORLEVEL% equ 0 goto node_ok
echo [ERROR] Node.js was not found on your system or in the .node22 folder!
echo Please install Node.js from https://nodejs.org or verify the .node22 directory.
echo.
pause
exit /b 1

:node_ok

:: 3. Clean up any previous hanging processes on ports 3000 and 5173
echo [*] Checking and preparing network ports 3000 and 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1

:: 4. Verify dependencies exist
if not exist "node_modules\" (
    echo [*] Installing root workspace dependencies...
    call npm.cmd install
)
if not exist "backend\node_modules\" (
    echo [*] Installing backend dependencies...
    call npm.cmd --prefix backend install
)
if not exist "frontend\node_modules\" (
    echo [*] Installing frontend dependencies...
    call npm.cmd --prefix frontend install
)

:: 5. Create Desktop shortcut if not already present
if exist "%USERPROFILE%\Desktop\Gmail Bulk Sender.lnk" goto shortcut_ready
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut(\"$env:USERPROFILE\Desktop\Gmail Bulk Sender.lnk\"); $s.TargetPath = '%~dp0START.bat'; $s.WorkingDirectory = '%~dp0'; $s.IconLocation = \"$env:SystemRoot\System32\shell32.dll, 156\"; $s.Description = 'Start Gmail Bulk Sender'; $s.Save()" >nul 2>&1

:shortcut_ready

:: 6. Launch browser automatically once server starts
echo [*] Launching your browser automatically in a few seconds...
start "" cmd /c "ping 127.0.0.1 -n 4 >nul & start http://localhost:5173"

echo [*] Starting Live Servers with Hot-Reload:
echo      - Web Application: http://localhost:5173
echo      - Backend API:     http://localhost:3000
echo.
echo =====================================================================
echo   [!] Live System is active!
echo   [!] To STOP the servers: Close this window or double-click STOP.bat
echo =====================================================================
echo.

:: 7. Run development server (Frontend + Backend concurrently)
call npm.cmd run dev
if %ERRORLEVEL% neq 0 (
    call npm run dev
)

echo.
echo Server stopped.
pause

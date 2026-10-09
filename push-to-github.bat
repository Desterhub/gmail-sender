@echo off
cd /d "%~dp0"
echo ==============================================
echo Pushing Gmail Bulk Sender to GitHub...
echo ==============================================
set PATH=%PATH%;C:\Users\HP\AppData\Local\Programs\Git\cmd;C:\Users\HP\AppData\Local\Programs\Git\mingw64\bin

:: Stage all modified/new files
git add .

:: Optional commit note, defaults to current timestamp
set "commit_msg="
set /p "commit_msg=Enter commit note (or press Enter for automatic backup): "
if "%commit_msg%"=="" set "commit_msg=Update: %date% %time%"

:: Commit if there are changes
git commit -m "%commit_msg%"

:: Push to GitHub
git push -u origin main

echo.
echo ==============================================
echo Operation completed!
echo ==============================================
pause

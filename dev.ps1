$env:PATH = "$PSScriptRoot\.node22\node-v22.14.0-win-x64;C:\Program Files\nodejs;$env:PATH"
Write-Host "Starting Gmail Bulk Sender (Backend + Frontend)..." -ForegroundColor Cyan
npm run dev

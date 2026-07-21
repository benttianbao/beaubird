@echo off
setlocal
set "BEAUBIRD_OFFLINE_PREDICTION_PORT=3210"
start "" /B powershell.exe -NoProfile -Command "$url='http://127.0.0.1:3210/api/health'; for($i=0; $i -lt 120; $i++){ try { Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1 | Out-Null; Start-Process 'http://127.0.0.1:3210'; exit 0 } catch { Start-Sleep -Milliseconds 500 } }"
node "%~dp0server\offline-prediction\server.js"

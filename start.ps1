$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; & '$root\.venv\Scripts\python.exe' app.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\whatsapp-bridge'; npm start"
Write-Host "Backend : http://localhost:5000"
Write-Host "Frontend : http://localhost:5173"
Write-Host "Admin : http://localhost:5173/admin (mot de passe par defaut : admin123)"
Write-Host "Pont WhatsApp : http://localhost:3100 (scannez le QR code a la premiere utilisation)"

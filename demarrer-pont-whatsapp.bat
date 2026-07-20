@echo off
title PONT WHATSAPP - SCANNEZ LE QR CODE
cd /d "%~dp0whatsapp-bridge"
echo Demarrage du pont WhatsApp...
echo Le QR code va apparaitre dans quelques secondes.
echo Scannez-le avec WhatsApp : Appareils connectes ^> Connecter un appareil
echo.
node index.js
pause

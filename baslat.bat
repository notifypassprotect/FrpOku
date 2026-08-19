@echo off
title FrpOku Baslatici
echo FrpOku yukleniyor, lutfen bekleyin...

:: Node.js kurulu mu kontrol et
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo HATA: Node.js bilgisayarinizda yuklu degil!
    echo Lutfen https://nodejs.org/ adresinden Node.js indirip kurun.
    pause
    exit /b
)

:: Gerekli paketleri kontrol et ve yukle
if not exist node_modules (
    echo Gerekli paketler yukleniyor (bu islem ilk seferde birkac dakika surebilir)...
    npm install
)

:: Sunucuyu baslat ve tarayiciyi ac
start "" http://localhost:3000
node server.js

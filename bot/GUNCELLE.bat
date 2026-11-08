@echo off
chcp 65001 >nul
title Tiktok Jetonlu Yayin Bulma - Guncelleme
cd /d "%~dp0"
echo Bot durduruluyor...
echo durdur> DURDUR
schtasks /End /TN "TiktokJetonBot" >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { $_.CommandLine -like '*tiktok_jeton_bot.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo En son surum indiriliyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol='Tls12'; $z=Join-Path $env:TEMP 'tj.zip'; $d=Join-Path $env:TEMP 'tj'; Invoke-WebRequest 'https://github.com/quarexinc/tiktokjeton/archive/refs/heads/main.zip' -OutFile $z; if (Test-Path $d) { Remove-Item $d -Recurse -Force }; Expand-Archive $z $d -Force; Copy-Item (Join-Path $d 'tiktokjeton-main\bot\*') -Destination '.' -Recurse -Force -Exclude 'config.json'"
if errorlevel 1 ( echo [!] Indirilemedi. Internet baglantisini kontrol et. & del DURDUR & pause & exit /b 1 )
".venv\Scripts\python.exe" -m pip install -q -r requirements.txt
del DURDUR
schtasks /Run /TN "TiktokJetonBot" >nul 2>&1
echo Guncellendi ve yeniden baslatildi.
pause

@echo off
chcp 65001 >nul
title Tiktok Jetonlu Yayin Bulma - Canli kayit
cd /d "%~dp0"
schtasks /Query /TN "TiktokJetonBot" /FO LIST 2>nul | findstr /I "Durum Status"
echo.
".venv\Scripts\python.exe" tiktok_jeton_bot.py --stats
echo.
echo  Canli kayit (kapatmak icin pencereyi kapat):
echo.
if not exist logs\bot.log ( echo  Henuz kayit yok. Bot yeni baslamis olabilir. & pause & exit /b 0 )
powershell -NoProfile -Command "Get-Content 'logs\bot.log' -Tail 40 -Wait -Encoding UTF8"

@echo off
chcp 65001 >nul
title Tiktok Jetonlu Yayin Bulma - Test calistirma
cd /d "%~dp0"
echo Bot bu pencerede ayrintili kayitla calisir. Arka plandaki bot calisiyorsa once DURDUR.bat ile durdur.
echo.
".venv\Scripts\python.exe" tiktok_jeton_bot.py -v
pause

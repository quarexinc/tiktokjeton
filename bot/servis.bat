@echo off
rem Zamanlanmis gorevin calistirdigi dongu. Bot cokerse 15 sn sonra yeniden baslatir.
cd /d "%~dp0"
if not exist logs mkdir logs
:dongu
if exist DURDUR exit /b 0
".venv\Scripts\python.exe" tiktok_jeton_bot.py >nul 2>>logs\hata.log
if exist DURDUR exit /b 0
timeout /t 15 /nobreak >nul
goto dongu

@echo off
cd /d "%~dp0"
if exist DURDUR del DURDUR
schtasks /Run /TN "TiktokJetonBot" >nul 2>&1
if errorlevel 1 ( echo Gorev bulunamadi. Once KURULUM.bat dosyasini yonetici olarak calistir. & pause & exit /b 1 )
echo Bot baslatildi. Kaydi izlemek icin DURUM.bat dosyasini ac.
pause

@echo off
cd /d "%~dp0"
echo durdur> DURDUR
schtasks /End /TN "TiktokJetonBot" >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { $_.CommandLine -like '*tiktok_jeton_bot.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo Bot durduruldu. Tekrar baslatmak icin BASLAT.bat dosyasini calistir.
pause

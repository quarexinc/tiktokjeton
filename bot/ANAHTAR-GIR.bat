@echo off
chcp 65001 >nul
title Tiktok Jetonlu Yayin Bulma - API anahtari
cd /d "%~dp0"
echo.
echo  Sitenin admin panelinde Otomasyon sekmesine gir, "Yeni anahtar olustur" de
echo  ve tjb_ ile baslayan anahtari kopyala. Burada sag tik ile yapistir.
echo.
set "KEY="
set "SITE="
set /p "KEY=  API anahtari: "
if not defined KEY ( echo  Anahtar girilmedi. & pause & exit /b 1 )
set /p "SITE=  Site adresi [Enter = https://tiktokjeton.vercel.app]: "
if not defined SITE set "SITE=https://tiktokjeton.vercel.app"

rem Temiz bir config.json olustur (BOM'suz, bosluksuz)
powershell -NoProfile -Command "$c = Get-Content 'config.example.json' -Raw -Encoding UTF8; $k = ($env:KEY -replace '\s','').Trim([char]34, [char]39); $u = $env:SITE.Trim().TrimEnd('/'); $c = $c.Replace('BURAYA_API_ANAHTARI', $k).Replace('https://tiktokjeton.vercel.app', $u); [IO.File]::WriteAllText((Join-Path (Get-Location) 'config.json'), $c, (New-Object Text.UTF8Encoding $false))"

echo.
".venv\Scripts\python.exe" tiktok_jeton_bot.py --test
if errorlevel 1 ( echo. & echo  Baglanti kurulamadi, yukaridaki hata mesajina bak. & pause & exit /b 1 )

echo.
echo  Bot yeni anahtarla yeniden baslatiliyor...
echo durdur> DURDUR
schtasks /End /TN "TiktokJetonBot" >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { $_.CommandLine -like '*tiktok_jeton_bot.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
del DURDUR
schtasks /Run /TN "TiktokJetonBot" >nul 2>&1
if errorlevel 1 ( echo  Arka plan gorevi yok. KURULUM.bat dosyasini yonetici olarak calistir. & pause & exit /b 1 )
echo  Tamam. Kaydi izlemek icin DURUM.bat dosyasini ac.
pause

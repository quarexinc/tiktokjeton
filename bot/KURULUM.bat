@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title Tiktok Jetonlu Yayin Bulma - Kurulum
cd /d "%~dp0"

echo.
echo  ==============================================
echo   Tiktok Jetonlu Yayin Bulma botu - Kurulum
echo  ==============================================
echo.

net session >nul 2>&1
if errorlevel 1 (
  echo  [!] Bu dosyaya sag tiklayip "Yonetici olarak calistir" de.
  pause & exit /b 1
)

rem ---------- 1) Python ----------
set "PY="
if exist "%ProgramFiles%\Python312\python.exe" set "PY=%ProgramFiles%\Python312\python.exe"
if not defined PY (
  for /f "delims=" %%P in ('where python 2^>nul') do (
    if not defined PY (
      "%%P" -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1 && set "PY=%%P"
    )
  )
)
if not defined PY (
  echo  [1/5] Python bulunamadi, indiriliyor ve kuruluyor. Bu 1-2 dakika surebilir...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe' -OutFile \"$env:TEMP\python-kurulum.exe\""
  if errorlevel 1 ( echo  [!] Python indirilemedi. https://www.python.org/downloads/ adresinden elle kur. & pause & exit /b 1 )
  "%TEMP%\python-kurulum.exe" /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
  set "PY=%ProgramFiles%\Python312\python.exe"
  if not exist "!PY!" ( echo  [!] Python kurulamadi. https://www.python.org/downloads/ adresinden elle kur. & pause & exit /b 1 )
) else (
  echo  [1/5] Python bulundu: !PY!
)

rem ---------- 2) Sanal ortam ve paketler ----------
echo  [2/5] Paketler kuruluyor...
if not exist ".venv\Scripts\python.exe" "!PY!" -m venv .venv
".venv\Scripts\python.exe" -m pip install -q --upgrade pip
".venv\Scripts\python.exe" -m pip install -q -r requirements.txt
if errorlevel 1 ( echo  [!] Paketler kurulamadi. Internet baglantisini kontrol et. & pause & exit /b 1 )

rem ---------- 3) Ayarlar ----------
if not exist config.json (
  echo.
  echo  [3/5] Ayarlar
  echo      Sitenin admin panelinde Otomasyon sekmesine gir, "Anahtar olustur" de ve anahtari kopyala.
  echo.
  set "SITE=https://tiktokjeton.vercel.app"
  set /p "SITE_IN=  Site adresi [https://tiktokjeton.vercel.app]: "
  if defined SITE_IN set "SITE=!SITE_IN!"
  set /p "KEY=  API anahtari (tjb_ ile baslar): "
  powershell -NoProfile -Command "$c = Get-Content 'config.example.json' -Raw -Encoding UTF8; $k = ($env:KEY -replace '\s','').Trim([char]34, [char]39); $u = $env:SITE.Trim().TrimEnd('/'); $c = $c.Replace('BURAYA_API_ANAHTARI', $k).Replace('https://tiktokjeton.vercel.app', $u); [IO.File]::WriteAllText((Join-Path (Get-Location) 'config.json'), $c, (New-Object Text.UTF8Encoding $false))"
) else (
  echo  [3/5] config.json zaten var, kullaniliyor.
)

rem ---------- 4) Baglanti testi ----------
echo  [4/5] Site baglantisi deneniyor...
".venv\Scripts\python.exe" tiktok_jeton_bot.py --test
if errorlevel 1 (
  echo.
  echo  [!] Siteye baglanilamadi. Yukaridaki hata mesajina bak, sonra ANAHTAR-GIR.bat ile anahtari tekrar gir.
  pause & exit /b 1
)

rem ---------- 5) Otomatik baslatma ----------
echo  [5/5] Bot Windows acilisinda otomatik baslayacak sekilde ayarlaniyor...
if exist DURDUR del DURDUR
schtasks /Create /F /TN "TiktokJetonBot" /SC ONSTART /DELAY 0000:30 /RU SYSTEM /RL HIGHEST /TR "\"%~dp0servis.bat\"" >nul
if errorlevel 1 ( echo  [!] Zamanlanmis gorev olusturulamadi. & pause & exit /b 1 )
schtasks /Run /TN "TiktokJetonBot" >nul

echo.
echo  ==============================================
echo   Kurulum tamam. Bot arka planda calisiyor.
echo  ==============================================
echo   DURUM.bat    : canli kaydi izle
echo   DURDUR.bat   : botu durdur
echo   BASLAT.bat   : botu tekrar baslat
echo   ANAHTAR-GIR.bat : API anahtarini degistir
echo   Sunucu yeniden baslasa da bot kendiliginden acilir.
echo   Admin panelinde Otomasyon sekmesinde "Calisiyor" yazmali.
echo.
pause

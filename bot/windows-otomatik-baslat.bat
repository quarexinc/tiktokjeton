@echo off
chcp 65001 >nul
cd /d "%~dp0"
net session >nul 2>&1 || (echo Bu dosyaya sag tiklayip "Yonetici olarak calistir" de. & pause & exit /b 1)
schtasks /Create /F /TN "TiktokJetonBot" /SC ONSTART /DELAY 0001:00 /RU SYSTEM /RL HIGHEST /TR "cmd /c \"\"%~dp0baslat.bat\"\"" 
if errorlevel 1 (echo Gorev olusturulamadi. & pause & exit /b 1)
echo Bot artik sunucu her acildiginda otomatik baslayacak.
echo Simdi baslatmak icin baslat.bat dosyasina cift tikla ya da sunucuyu yeniden baslat.
pause

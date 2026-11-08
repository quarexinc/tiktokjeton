@echo off
chcp 65001 >nul
title Tiktok Jetonlu Yayin Bulma Botu
cd /d "%~dp0"
where python >nul 2>nul || (echo Python bulunamadi. https://www.python.org/downloads/ adresinden kur ve "Add to PATH" kutusunu isaretle. & pause & exit /b 1)
if not exist config.json (copy config.example.json config.json >nul & echo config.json olusturuldu. Icine api_key yapistir ve tekrar calistir. & notepad config.json & pause & exit /b 1)
python -m pip install -q -r requirements.txt
python tiktok_jeton_bot.py
pause

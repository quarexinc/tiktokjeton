#!/usr/bin/env bash
cd "$(dirname "$0")"
[ -f config.json ] || { cp config.example.json config.json; echo "config.json oluşturuldu. İçine api_key yapıştır ve tekrar çalıştır."; exit 1; }
python3 -m pip install -q -r requirements.txt
exec python3 tiktok_jeton_bot.py "$@"

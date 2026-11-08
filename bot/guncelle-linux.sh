#!/usr/bin/env bash
# Botun yeni sürümünü GitHub'dan çekip servisi yeniden başlatır.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
if git -C "$DIR" rev-parse >/dev/null 2>&1; then git pull --ff-only; fi
"$DIR/.venv/bin/pip" install -q -r requirements.txt
sudo systemctl restart tiktokjeton-bot
echo "Güncellendi ve yeniden başlatıldı."

#!/usr/bin/env bash
# Ubuntu/Debian VDS kurulumu: botu systemd servisi olarak 7/24 çalıştırır.
# Kullanım:  sudo bash kur-linux.sh
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE=tiktokjeton-bot
RUN_USER="${SUDO_USER:-$(whoami)}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Bu betiği sudo ile çalıştır: sudo bash kur-linux.sh"; exit 1
fi

echo "> Paketler kuruluyor"
apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip >/dev/null

echo "> Sanal ortam hazırlanıyor"
sudo -u "$RUN_USER" python3 -m venv "$DIR/.venv"
sudo -u "$RUN_USER" "$DIR/.venv/bin/pip" install -q --upgrade pip
sudo -u "$RUN_USER" "$DIR/.venv/bin/pip" install -q -r "$DIR/requirements.txt"

if [ ! -f "$DIR/config.json" ]; then
  sudo -u "$RUN_USER" cp "$DIR/config.example.json" "$DIR/config.json"
  echo
  echo "config.json oluşturuldu. İçine api_key yapıştır:  nano $DIR/config.json"
  echo "Sonra bu betiği tekrar çalıştır."
  exit 0
fi

echo "> Site bağlantısı deneniyor"
sudo -u "$RUN_USER" "$DIR/.venv/bin/python" "$DIR/tiktok_jeton_bot.py" --test

echo "> Servis yazılıyor"
cat > /etc/systemd/system/$SERVICE.service <<UNIT
[Unit]
Description=Tiktok Jetonlu Yayin Bulma botu
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$DIR
ExecStart=$DIR/.venv/bin/python $DIR/tiktok_jeton_bot.py
Restart=always
RestartSec=15
Environment=PYTHONUNBUFFERED=1
# Çok sayıda eş zamanlı bağlantı için
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now $SERVICE
sleep 3
systemctl --no-pager --lines=5 status $SERVICE || true

cat <<INFO

Bot servis olarak çalışıyor ve sunucu yeniden başlasa da kendiliğinden açılır.
  Canlı kayıt:      journalctl -u $SERVICE -f
  Kayıt dosyası:    tail -f $DIR/logs/bot.log
  Keşif özeti:      $DIR/.venv/bin/python $DIR/tiktok_jeton_bot.py --stats
  Yeniden başlat:   sudo systemctl restart $SERVICE
  Durdur:           sudo systemctl stop $SERVICE
INFO

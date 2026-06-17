#!/bin/bash
# Deploy or update My Hive IoT node on Raspberry Pi.
# Run from the repo root after git pull, or copy this script to the Pi.
set -euo pipefail

IOT_DIR="${IOT_DIR:-$HOME/projects/iot-node}"
REPO_DIR="${REPO_DIR:-$HOME/projects/My-Hive}"
SOURCE_DIR="$REPO_DIR/devices/iot-node"

echo "==> My Hive IoT node setup"
echo "    Target: $IOT_DIR"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "ERROR: Source not found at $SOURCE_DIR"
  echo "Clone the repo first:"
  echo "  git clone https://github.com/Newjack1108/My-Hive.git $REPO_DIR"
  exit 1
fi

mkdir -p "$IOT_DIR"
rsync -av --delete \
  --exclude venv \
  --exclude .env \
  --exclude calibration.json \
  --exclude logs \
  --exclude __pycache__ \
  "$SOURCE_DIR/" "$IOT_DIR/"

mkdir -p "$IOT_DIR/logs"
chmod +x "$IOT_DIR/deploy/"*.sh 2>/dev/null || true

if [[ ! -d "$IOT_DIR/venv" ]]; then
  echo "==> Creating virtualenv (with system-site-packages for picamera2)"
  python3 -m venv --system-site-packages "$IOT_DIR/venv"
fi

echo "==> Installing dependencies"
# shellcheck disable=SC1091
source "$IOT_DIR/venv/bin/activate"
pip install --upgrade pip
pip install -r "$IOT_DIR/requirements.txt"

if [[ ! -f "$IOT_DIR/.env" ]]; then
  cp "$IOT_DIR/.env.example" "$IOT_DIR/.env"
  echo "==> Created .env from example — edit $IOT_DIR/.env before production use"
fi

echo "==> Testing heartbeat (dry run)"
cd "$IOT_DIR"
python heartbeat.py || true

echo ""
echo "Done. Next steps:"
echo "  1. Edit $IOT_DIR/.env (DEVICE_KEY, probe IDs, etc.)"
echo "  2. Test:  cd $IOT_DIR && source venv/bin/activate && python heartbeat.py"
echo "  3. Cron:   crontab -e  # paste deploy/cron/heartbeat.cron"
echo "  4. Camera: sudo bash deploy/setup-camera.sh && python test_camera.py"
echo "  5. Bees:   sudo cp deploy/systemd/bee-counter.service /etc/systemd/system/"
echo "             sudo systemctl enable --now bee-counter"

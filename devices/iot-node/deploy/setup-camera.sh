#!/bin/bash
# Install and enable Raspberry Pi Camera Module for bee counter.
# Run on the Pi: sudo bash deploy/setup-camera.sh
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/setup-camera.sh"
  exit 1
fi

REAL_USER="${SUDO_USER:-$USER}"
REAL_HOME="$(getent passwd "$REAL_USER" | cut -d: -f6)"
IOT_DIR="${IOT_DIR:-$REAL_HOME/projects/iot-node}"

if [[ ! -f "$IOT_DIR/heartbeat.py" ]]; then
  echo "ERROR: IoT node not found at $IOT_DIR"
  echo "Run first: ./deploy/setup-pi.sh"
  exit 1
fi

echo "==> Installing camera system packages"
apt-get update
apt-get install -y \
  libcamera-apps \
  python3-picamera2 \
  python3-libcamera \
  v4l-utils

echo "==> Enabling camera interface"
if command -v raspi-config >/dev/null 2>&1; then
  raspi-config nonint do_camera 0 || true
fi

CONFIG_TXT="/boot/firmware/config.txt"
if [[ ! -f "$CONFIG_TXT" ]]; then
  CONFIG_TXT="/boot/config.txt"
fi

if [[ -f "$CONFIG_TXT" ]]; then
  if grep -q "^camera_auto_detect=0" "$CONFIG_TXT"; then
    sed -i 's/^camera_auto_detect=0/camera_auto_detect=1/' "$CONFIG_TXT"
    echo "    Enabled camera_auto_detect in $CONFIG_TXT (reboot may be required)"
  elif ! grep -q "camera_auto_detect=1" "$CONFIG_TXT"; then
    echo "camera_auto_detect=1" >> "$CONFIG_TXT"
    echo "    Added camera_auto_detect=1 (reboot may be required)"
  fi
fi

echo "==> Listing cameras (libcamera)"
if libcamera-hello --list-cameras 2>/dev/null; then
  echo "    libcamera sees camera(s)"
else
  echo "    WARNING: libcamera did not list cameras — check ribbon cable and reboot"
fi

echo "==> Recreating venv with system site packages (for picamera2)"
VENV_DIR="$IOT_DIR/venv"
if [[ -d "$VENV_DIR" ]]; then
  sudo -u "$REAL_USER" rm -rf "$VENV_DIR"
fi
sudo -u "$REAL_USER" python3 -m venv --system-site-packages "$VENV_DIR"
sudo -u "$REAL_USER" "$VENV_DIR/bin/pip" install --upgrade pip
sudo -u "$REAL_USER" "$VENV_DIR/bin/pip" install -r "$IOT_DIR/requirements.txt"

echo "==> Updating .env for Pi Camera"
ENV_FILE="$IOT_DIR/.env"
touch "$ENV_FILE"
chown "$REAL_USER:$REAL_USER" "$ENV_FILE"
grep -q '^IOT_BEES_ENABLED=' "$ENV_FILE" && \
  sed -i 's/^IOT_BEES_ENABLED=.*/IOT_BEES_ENABLED=true/' "$ENV_FILE" || \
  echo 'IOT_BEES_ENABLED=true' >> "$ENV_FILE"
grep -q '^IOT_BEE_CAMERA_BACKEND=' "$ENV_FILE" && \
  sed -i 's/^IOT_BEE_CAMERA_BACKEND=.*/IOT_BEE_CAMERA_BACKEND=picamera2/' "$ENV_FILE" || \
  echo 'IOT_BEE_CAMERA_BACKEND=picamera2' >> "$ENV_FILE"

echo ""
echo "==> Camera setup complete"
echo "Next (as $REAL_USER):"
echo "  cd $IOT_DIR"
echo "  source venv/bin/activate"
echo "  python test_camera.py"
echo ""
echo "If libcamera did not see the camera, reboot: sudo reboot"
echo "Then start bee counter:"
echo "  sudo cp $IOT_DIR/deploy/systemd/bee-counter.service /etc/systemd/system/"
echo "  sudo systemctl enable --now bee-counter"

#!/bin/bash
# Enable 1-Wire and install DS18B20 temperature sensor support.
# Run on the Pi: sudo bash deploy/setup-temp.sh
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/setup-temp.sh"
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

echo "==> Enabling 1-Wire interface"
if command -v raspi-config >/dev/null 2>&1; then
  raspi-config nonint do_onewire 0 || true
fi

CONFIG_TXT="/boot/firmware/config.txt"
if [[ ! -f "$CONFIG_TXT" ]]; then
  CONFIG_TXT="/boot/config.txt"
fi

if [[ -f "$CONFIG_TXT" ]] && ! grep -qE '^dtoverlay=w1-gpio' "$CONFIG_TXT"; then
  echo "dtoverlay=w1-gpio" >> "$CONFIG_TXT"
  echo "    Added dtoverlay=w1-gpio to $CONFIG_TXT (reboot may be required)"
fi

echo "==> Loading 1-Wire kernel modules"
modprobe w1-gpio 2>/dev/null || true
modprobe w1-therm 2>/dev/null || true

echo "==> Installing Python w1thermsensor in venv"
VENV_DIR="$IOT_DIR/venv"
if [[ ! -d "$VENV_DIR" ]]; then
  sudo -u "$REAL_USER" python3 -m venv --system-site-packages "$VENV_DIR"
fi
sudo -u "$REAL_USER" "$VENV_DIR/bin/pip" install --upgrade pip
sudo -u "$REAL_USER" "$VENV_DIR/bin/pip" install w1thermsensor

echo "==> Scanning for DS18B20 probes"
sleep 2
if [[ -d /sys/bus/w1/devices ]]; then
  PROBES=$(ls /sys/bus/w1/devices/ 2>/dev/null | grep '^28-' || true)
  if [[ -n "$PROBES" ]]; then
    echo "    Found probe(s):"
    echo "$PROBES" | sed 's/^/      /'
  else
    echo "    No DS18B20 probes detected yet."
    echo "    Wire probes, then reboot and run: python test_temps.py"
  fi
else
  echo "    /sys/bus/w1/devices not found — reboot after setup"
fi

ENV_FILE="$IOT_DIR/.env"
touch "$ENV_FILE"
chown "$REAL_USER:$REAL_USER" "$ENV_FILE"

# Auto-assign if exactly two probes and IDs not set
PROBE_ARRAY=($(ls /sys/bus/w1/devices/ 2>/dev/null | grep '^28-' | sort || true))
if [[ ${#PROBE_ARRAY[@]} -ge 1 ]] && ! grep -q '^IOT_INTERNAL_PROBE_ID=28-' "$ENV_FILE" 2>/dev/null; then
  if ! grep -q '^IOT_INTERNAL_PROBE_ID=' "$ENV_FILE"; then
    echo "IOT_INTERNAL_PROBE_ID=${PROBE_ARRAY[0]}" >> "$ENV_FILE"
  else
    sed -i "s/^IOT_INTERNAL_PROBE_ID=.*/IOT_INTERNAL_PROBE_ID=${PROBE_ARRAY[0]}/" "$ENV_FILE"
  fi
  echo "    Set IOT_INTERNAL_PROBE_ID=${PROBE_ARRAY[0]} in .env"
fi
if [[ ${#PROBE_ARRAY[@]} -ge 2 ]] && ! grep -q '^IOT_EXTERNAL_PROBE_ID=28-' "$ENV_FILE" 2>/dev/null; then
  if ! grep -q '^IOT_EXTERNAL_PROBE_ID=' "$ENV_FILE"; then
    echo "IOT_EXTERNAL_PROBE_ID=${PROBE_ARRAY[1]}" >> "$ENV_FILE"
  else
    sed -i "s/^IOT_EXTERNAL_PROBE_ID=.*/IOT_EXTERNAL_PROBE_ID=${PROBE_ARRAY[1]}/" "$ENV_FILE"
  fi
  echo "    Set IOT_EXTERNAL_PROBE_ID=${PROBE_ARRAY[1]} in .env"
fi

echo ""
echo "==> Temperature setup complete"
echo "Next (as $REAL_USER):"
echo "  cd $IOT_DIR"
echo "  source venv/bin/activate"
echo "  python test_temps.py"
echo "  python heartbeat.py"
echo ""
echo "If no probes found, check wiring and run: sudo reboot"

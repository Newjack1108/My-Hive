# My Hive IoT Node (Raspberry Pi)

Collects hive sensors and posts heartbeats to My Hive `POST /api/device-heartbeat`.

## Quick start on the Pi

```bash
cd ~/projects/iot-node
python3 -m venv --system-site-packages venv
source venv/bin/activate
pip install -r requirements.txt

# Copy from monorepo or clone devices/iot-node
cp .env.example .env
# Edit .env with your DEVICE_KEY and probe IDs

python heartbeat.py
```

## Payload format

```json
{
  "device_id": "pi-001",
  "device_name": "Hive 1 Entrance Node",
  "status": "online",
  "timestamp": "2026-06-12T12:45:23+00:00",
  "sensors": {
    "cpu_temp_c": 49.6,
    "internal_temp_c": 34.2,
    "external_temp_c": 18.5,
    "weight_kg": 42.7,
    "weight_stable": true
  },
  "bees": {
    "in_count": 12,
    "out_count": 8,
    "window_seconds": 300,
    "since": "2026-06-12T12:40:23Z"
  }
}
```

Status values: `online` (all OK), `degraded` (some sensors failed), `error` (no readings).

## Phase 1 — Temperature (DS18B20)

1. Enable 1-Wire: `sudo raspi-config` → Interface Options → 1-Wire
2. Connect probes; find IDs: `ls /sys/bus/w1/devices/`
3. Set in `.env`:
   ```
   IOT_INTERNAL_PROBE_ID=28-xxxxxxxxxxxx
   IOT_EXTERNAL_PROBE_ID=28-yyyyyyyyyyyy
   ```

## Phase 2 — Weight (HX711)

1. Set `IOT_WEIGHT_ENABLED=true` and GPIO pins in `.env`
2. Calibrate:
   ```bash
   python calibrate_weight.py --tare
   python calibrate_weight.py --calibrate 5.0
   ```

## Phase 3 — Pi Camera and bee counting

### Hardware

1. Connect the **Pi Camera ribbon cable** to the CSI port (silver contacts face the HDMI port on Pi 4/5).
2. Mount the camera facing the hive entrance / landing board.

### Software install (on the Pi)

Pull latest code, then run the camera setup script:

```bash
cd ~/projects/My-Hive
git pull
cd devices/iot-node
chmod +x deploy/setup-camera.sh
sudo ./deploy/setup-camera.sh
```

This installs `libcamera` + `picamera2`, enables the camera interface, recreates the venv with system packages, and sets `IOT_BEES_ENABLED=true`.

**Reboot if the camera is not detected:**

```bash
sudo reboot
```

### Test the camera

```bash
cd ~/projects/iot-node
source venv/bin/activate

# Quick libcamera check (system)
libcamera-hello --list-cameras
libcamera-still -o /tmp/test.jpg

# Python test (saves logs/camera_test.jpg)
python test_camera.py
```

### Start bee counter

```bash
sudo cp deploy/systemd/bee-counter.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bee-counter
sudo systemctl status bee-counter
```

Heartbeat reads `/tmp/bee_counts.json` and resets counts after each successful POST.

Tune the entrance region in `.env` if needed: `IOT_BEE_ROI_X`, `IOT_BEE_ROI_Y`, `IOT_BEE_ROI_W`, `IOT_BEE_ROI_H`.

### USB camera instead of Pi Camera

Set in `.env`:

```
IOT_BEE_CAMERA_BACKEND=opencv
IOT_BEE_CAMERA_INDEX=0
```

### YOLO upgrade (if MOG2 accuracy is poor)

```bash
pip install ultralytics
```

Set `IOT_BEE_USE_YOLO=true` in `.env` or `bee-counter.service`.

## Phase 4 — Scheduling

**Cron (simple):**
```bash
crontab -e
# Paste line from deploy/cron/heartbeat.cron
```

**systemd timer (alternative):**
```bash
sudo cp deploy/systemd/iot-heartbeat.service /etc/systemd/system/
sudo cp deploy/systemd/iot-heartbeat.timer /etc/systemd/system/
sudo systemctl enable --now iot-heartbeat.timer
```

## Resilience

- Request timeout defaults to 30s (`IOT_REQUEST_TIMEOUT`)
- Failed payloads saved to `logs/pending_payload.json` and retried on next run
- Logs: `logs/heartbeat.log`

## Verify in database

```sql
SELECT payload->'sensors', payload->'bees', received_at
FROM device_heartbeats
ORDER BY received_at DESC
LIMIT 5;
```

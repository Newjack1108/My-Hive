# My Hive IoT Node (Raspberry Pi)

Collects hive sensors and posts heartbeats to My Hive `POST /api/device-heartbeat`.

## Quick start on the Pi

```bash
cd ~/projects/iot-node
python3 -m venv venv
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

## Phase 3 — Bee counting

1. Mount camera on hive entrance; tune ROI in `.env` if needed
2. Set `IOT_BEES_ENABLED=true`
3. Start counter daemon:
   ```bash
   sudo cp deploy/systemd/bee-counter.service /etc/systemd/system/
   sudo systemctl enable --now bee-counter
   ```
4. Heartbeat reads `/tmp/bee_counts.json` and resets counts after successful POST

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

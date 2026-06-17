#!/usr/bin/env python3
"""
Hive IoT heartbeat — collect sensor readings and POST to My Hive API.

Run manually or via cron every 5 minutes.
"""

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

# Ensure package root is on path when run as script
sys.path.insert(0, str(Path(__file__).resolve().parent))

import config
from sensors import (
    read_bee_counts,
    read_cpu,
    read_temperatures,
    read_weight,
    reset_bee_counts_after_read,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def collect_sensors() -> tuple[dict, list[str]]:
    """Gather all sensor readings. Returns (sensors dict, list of failed sensor names)."""
    sensors: dict = {}
    failures: list[str] = []

    cpu = read_cpu()
    if cpu:
        sensors.update(cpu)
    else:
        failures.append("cpu")

    temps = read_temperatures()
    if config.INTERNAL_PROBE_ID and "internal_temp_c" not in temps:
        failures.append("internal_temp")
    if (config.EXTERNAL_PROBE_ID or config.USE_BME280_EXTERNAL) and "external_temp_c" not in temps:
        failures.append("external_temp")
    sensors.update(temps)

    weight = read_weight()
    if weight:
        sensors.update(weight)
    elif config.WEIGHT_ENABLED:
        failures.append("weight")

    return sensors, failures


def determine_status(sensors: dict, failures: list[str]) -> str:
    """online | degraded | error"""
    if not sensors and failures:
        return "error"
    if failures:
        return "degraded"
    return "online"


def build_payload() -> dict:
    """Build standardized heartbeat payload."""
    sensors, failures = collect_sensors()
    bees = read_bee_counts()

    payload = {
        "device_id": config.DEVICE_ID,
        "device_name": config.DEVICE_NAME,
        "status": determine_status(sensors, failures),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if sensors:
        payload["sensors"] = sensors

    if bees:
        payload["bees"] = bees

    if failures:
        payload["sensor_errors"] = failures

    return payload


def queue_failed_payload(payload: dict) -> None:
    """Save payload locally when API is unreachable."""
    config.LOGS_DIR.mkdir(parents=True, exist_ok=True)
    try:
        with open(config.FAILED_PAYLOAD_QUEUE, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        logger.info("Queued payload for retry at %s", config.FAILED_PAYLOAD_QUEUE)
    except OSError as exc:
        logger.error("Could not queue payload: %s", exc)


def send_payload(payload: dict) -> bool:
    """POST payload to My Hive. Returns True on success."""
    headers = {
        "Content-Type": "application/json",
        "X-Device-Key": config.DEVICE_KEY,
    }

    try:
        response = requests.post(
            config.API_URL,
            json=payload,
            headers=headers,
            timeout=config.REQUEST_TIMEOUT_SECONDS,
        )
        print("Status code:", response.status_code)
        print("Response:", response.text)
        print("Sent payload:", payload)

        if response.ok:
            if config.FAILED_PAYLOAD_QUEUE.exists():
                config.FAILED_PAYLOAD_QUEUE.unlink(missing_ok=True)
            if "bees" in payload:
                reset_bee_counts_after_read()
            return True

        logger.error("API returned %s: %s", response.status_code, response.text)
        return False

    except requests.RequestException as exc:
        print("Error sending heartbeat:", exc)
        logger.error("Request failed: %s", exc)
        return False


def retry_pending_payload() -> bool:
    """Attempt to send a previously queued payload."""
    path = config.FAILED_PAYLOAD_QUEUE
    if not path.exists():
        return False
    try:
        with open(path, encoding="utf-8") as f:
            payload = json.load(f)
        logger.info("Retrying queued payload...")
        return send_payload(payload)
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Could not retry queued payload: %s", exc)
        return False


def main() -> int:
    config.LOGS_DIR.mkdir(parents=True, exist_ok=True)

    if retry_pending_payload():
        logger.info("Queued payload sent successfully")

    payload = build_payload()

    if send_payload(payload):
        return 0

    queue_failed_payload(payload)
    return 1


if __name__ == "__main__":
    sys.exit(main())

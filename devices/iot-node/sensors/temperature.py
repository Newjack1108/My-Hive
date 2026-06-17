"""List and read DS18B20 1-Wire temperature probes."""

import logging
import time
from pathlib import Path

import config

logger = logging.getLogger(__name__)

W1_DEVICES_DIR = Path("/sys/bus/w1/devices")


def normalize_probe_id(probe_id: str) -> str:
    """Return full W1 device id: 28-xxxxxxxxxxxx."""
    probe_id = probe_id.strip()
    if probe_id.startswith("28-"):
        return probe_id
    return f"28-{probe_id}"


def list_ds18b20_probes() -> list[dict]:
    """
    List DS18B20 probes on the 1-Wire bus.

    Returns list of dicts: id (28-...), serial, path.
    """
    probes: list[dict] = []
    if not W1_DEVICES_DIR.is_dir():
        return probes

    for entry in sorted(W1_DEVICES_DIR.iterdir()):
        name = entry.name
        if not name.startswith("28-"):
            continue
        probes.append(
            {
                "id": name,
                "serial": name.split("-", 1)[1],
                "path": str(entry),
            }
        )
    return probes


def _read_sysfs_temp(full_id: str) -> float | None:
    """Read temperature directly from sysfs (most reliable on modern Pi OS)."""
    base = W1_DEVICES_DIR / full_id
    if not base.is_dir():
        return None

    temp_file = base / "temperature"
    if temp_file.exists():
        try:
            millis = int(temp_file.read_text().strip())
            return round(millis / 1000.0, 1)
        except (OSError, ValueError) as exc:
            logger.debug("temperature file read failed for %s: %s", full_id, exc)

    slave_file = base / "w1_slave"
    if not slave_file.exists():
        return None

    # First read triggers conversion; second read after brief wait has data
    for attempt in range(2):
        try:
            lines = slave_file.read_text().splitlines()
            if lines and lines[0].strip().endswith("YES"):
                for line in lines:
                    if "t=" in line:
                        millis = int(line.split("t=")[1])
                        return round(millis / 1000.0, 1)
        except (OSError, ValueError, IndexError) as exc:
            logger.debug("w1_slave read failed for %s: %s", full_id, exc)
        if attempt == 0:
            time.sleep(0.75)

    return None


def _read_w1thermsensor(probe_id: str) -> float | None:
    """Fallback read via w1thermsensor library."""
    try:
        from w1thermsensor import SensorNotReadyError, W1ThermSensor
    except ImportError:
        return None

    full_id = normalize_probe_id(probe_id)
    serial = full_id.split("-", 1)[1]
    for sensor_id in (full_id, serial):
        try:
            sensor = W1ThermSensor(sensor_id=sensor_id)
            return round(sensor.get_temperature(), 1)
        except (SensorNotReadyError, OSError, ValueError):
            continue
    return None


def read_probe_temp(probe_id: str) -> float | None:
    """Read a single DS18B20 probe by id (28-xxx or serial only)."""
    if not probe_id:
        return None

    full_id = normalize_probe_id(probe_id)

    temp = _read_sysfs_temp(full_id)
    if temp is not None:
        return temp

    temp = _read_w1thermsensor(probe_id)
    if temp is not None:
        return temp

    logger.warning("DS18B20 probe %s failed all read methods", full_id)
    return None


def _read_ds18b20(probe_id: str) -> float | None:
    return read_probe_temp(probe_id)


def _read_bme280() -> dict | None:
    """Read external temp (and humidity) from BME280 over I2C."""
    if not config.USE_BME280_EXTERNAL:
        return None
    try:
        import board
        import busio
        import adafruit_bme280

        i2c = busio.I2C(board.SCL, board.SDA)
        bme = adafruit_bme280.Adafruit_BME280_I2C(i2c, address=config.BME280_I2C_ADDRESS)
        result: dict = {"external_temp_c": round(bme.temperature, 1)}
        if bme.humidity is not None:
            result["external_humidity_pct"] = round(bme.humidity, 1)
        return result
    except ImportError:
        logger.warning("adafruit_bme280 not installed; skipping BME280")
        return None
    except (OSError, ValueError, RuntimeError) as exc:
        logger.warning("BME280 read failed: %s", exc)
        return None


def read_temperatures() -> dict:
    """
    Read configured temperature probes.

    Returns dict with any of: internal_temp_c, external_temp_c, external_humidity_pct.
    """
    readings: dict = {}

    internal = _read_ds18b20(config.INTERNAL_PROBE_ID)
    if internal is not None:
        readings["internal_temp_c"] = internal

    if config.USE_BME280_EXTERNAL:
        bme = _read_bme280()
        if bme:
            readings.update(bme)
    else:
        external = _read_ds18b20(config.EXTERNAL_PROBE_ID)
        if external is not None:
            readings["external_temp_c"] = external

    return readings

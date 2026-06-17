"""List and read DS18B20 1-Wire temperature probes."""

import logging
from pathlib import Path

import config

logger = logging.getLogger(__name__)

W1_DEVICES_DIR = Path("/sys/bus/w1/devices")


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


def _read_ds18b20(probe_id: str) -> float | None:
    """Read a single DS18B20 probe by W1 device ID (28-xxxxxxxxxxxx)."""
    if not probe_id:
        return None
    try:
        from w1thermsensor import SensorNotReadyError, W1ThermSensor

        sensor = W1ThermSensor(sensor_id=probe_id)
        return round(sensor.get_temperature(), 1)
    except ImportError:
        logger.warning("w1thermsensor not installed; skipping DS18B20")
        return None
    except (SensorNotReadyError, OSError, ValueError) as exc:
        logger.warning("DS18B20 probe %s failed: %s", probe_id, exc)
        return None


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

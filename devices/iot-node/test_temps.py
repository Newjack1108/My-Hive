#!/usr/bin/env python3
"""Scan and test DS18B20 temperature probes."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config
from sensors.temperature import list_ds18b20_probes, read_temperatures


def main() -> int:
    print("=== DS18B20 temperature test ===\n")

    w1_dir = Path("/sys/bus/w1/devices")
    if not w1_dir.is_dir():
        print("ERROR: 1-Wire not enabled (no /sys/bus/w1/devices)")
        print("Run: sudo bash deploy/setup-temp.sh")
        return 1

    probes = list_ds18b20_probes()
    print(f"Found {len(probes)} DS18B20 probe(s) on 1-Wire bus:\n")

    if not probes:
        print("  (none)")
        print("\nCheck wiring:")
        print("  Red    -> 3.3V (pin 1)")
        print("  Black  -> GND  (pin 6)")
        print("  Yellow -> GPIO 4 (pin 7)")
        print("  4.7k resistor between DATA and 3.3V if not built into probe")
        return 1

    from w1thermsensor import W1ThermSensor

    for i, probe in enumerate(probes):
        try:
            sensor = W1ThermSensor(sensor_id=probe["id"])
            temp = round(sensor.get_temperature(), 1)
            label = ""
            if probe["id"] == config.INTERNAL_PROBE_ID:
                label = " [internal in .env]"
            elif probe["id"] == config.EXTERNAL_PROBE_ID:
                label = " [external in .env]"
            print(f"  [{i}] {probe['id']}  {temp} C{label}")
        except Exception as exc:
            print(f"  [{i}] {probe['id']}  read failed: {exc}")

    print("\n--- .env configuration ---")
    print(f"  IOT_INTERNAL_PROBE_ID={config.INTERNAL_PROBE_ID or '(not set)'}")
    print(f"  IOT_EXTERNAL_PROBE_ID={config.EXTERNAL_PROBE_ID or '(not set)'}")

    if len(probes) >= 1 and not config.INTERNAL_PROBE_ID:
        print(f"\nSuggested internal: IOT_INTERNAL_PROBE_ID={probes[0]['id']}")
    if len(probes) >= 2 and not config.EXTERNAL_PROBE_ID:
        print(f"Suggested external: IOT_EXTERNAL_PROBE_ID={probes[1]['id']}")

    readings = read_temperatures()
    print("\n--- heartbeat readings ---")
    if readings:
        for key, value in readings.items():
            print(f"  {key}: {value}")
    else:
        print("  (no readings — set probe IDs in .env)")

    return 0 if readings else 1


if __name__ == "__main__":
    sys.exit(main())

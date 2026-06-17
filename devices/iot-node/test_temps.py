#!/usr/bin/env python3
"""Scan and test DS18B20 temperature probes."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config
from sensors.temperature import list_ds18b20_probes, read_probe_temp, read_temperatures


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

    for i, probe in enumerate(probes):
        temp = read_probe_temp(probe["id"])
        label = ""
        if probe["id"] == config.INTERNAL_PROBE_ID:
            label = " [internal in .env]"
        elif probe["id"] == config.EXTERNAL_PROBE_ID:
            label = " [external in .env]"
        if temp is not None:
            print(f"  [{i}] {probe['id']}  {temp} C{label}")
        else:
            print(f"  [{i}] {probe['id']}  read failed")

    print("\n--- .env configuration ---")
    print(f"  IOT_INTERNAL_PROBE_ID={config.INTERNAL_PROBE_ID or '(not set)'}")
    print(f"  IOT_EXTERNAL_PROBE_ID={config.EXTERNAL_PROBE_ID or '(not set)'}")

    if len(probes) >= 1 and not config.INTERNAL_PROBE_ID:
        print(f"\nAdd to .env:  IOT_INTERNAL_PROBE_ID={probes[0]['id']}")
    if len(probes) >= 2 and not config.EXTERNAL_PROBE_ID:
        print(f"Add to .env:  IOT_EXTERNAL_PROBE_ID={probes[1]['id']}")

    readings = read_temperatures()
    print("\n--- heartbeat readings ---")
    if readings:
        for key, value in readings.items():
            print(f"  {key}: {value}")
    else:
        print("  (no readings — add probe ID to .env, then retry)")

    return 0 if readings else 1


if __name__ == "__main__":
    sys.exit(main())

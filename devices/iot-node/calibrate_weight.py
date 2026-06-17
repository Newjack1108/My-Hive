#!/usr/bin/env python3
"""
HX711 load cell calibration utility.

Usage on Pi:
  1. Remove all weight from scale, run: python calibrate_weight.py --tare
  2. Place known mass (e.g. 5 kg), run: python calibrate_weight.py --calibrate 5.0
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config


def main() -> int:
    parser = argparse.ArgumentParser(description="Calibrate HX711 load cell")
    parser.add_argument("--tare", action="store_true", help="Record tare offset (empty scale)")
    parser.add_argument(
        "--calibrate",
        type=float,
        metavar="KG",
        help="Calibrate with known mass in kg on scale",
    )
    args = parser.parse_args()

    if not args.tare and args.calibrate is None:
        parser.print_help()
        return 1

    try:
        from hx711 import HX711
    except ImportError:
        print("Install hx711: pip install hx711")
        return 1

    hx = HX711(dout_pin=config.HX711_DOUT_PIN, pd_sck_pin=config.HX711_SCK_PIN)
    cal = config.load_calibration()
    hx.set_reference_unit(cal.get("reference_unit", 1.0))
    hx.reset()

    if args.tare:
        print("Taring scale (ensure platform is empty)...")
        hx.tare()
        cal["tare_offset"] = hx.get_offset()
        config.save_calibration(cal)
        print(f"Saved tare_offset={cal['tare_offset']}")
        return 0

    if args.calibrate is not None:
        known_kg = args.calibrate
        print(f"Reading with {known_kg} kg on scale...")
        hx.tare()
        reading = hx.get_weight(10)
        if not reading or reading == 0:
            print("Invalid reading; check wiring and weight")
            return 1
        scale_factor = reading / known_kg
        cal["scale_factor"] = scale_factor
        cal["reference_unit"] = scale_factor
        config.save_calibration(cal)
        print(f"Saved scale_factor={scale_factor:.4f} for {known_kg} kg reference")
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())

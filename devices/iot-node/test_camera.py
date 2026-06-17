#!/usr/bin/env python3
"""Test Pi Camera / USB camera and save a snapshot."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config
from sensors.camera import create_camera


def main() -> int:
    out = Path(__file__).parent / "logs" / "camera_test.jpg"
    out.parent.mkdir(parents=True, exist_ok=True)

    print(f"Camera backend setting: {config.BEE_CAMERA_BACKEND}")
    print(f"Resolution: {config.BEE_CAMERA_WIDTH}x{config.BEE_CAMERA_HEIGHT}")

    camera = create_camera()
    if camera is None:
        print("ERROR: Could not open any camera.")
        print("Run: sudo ./deploy/setup-camera.sh")
        return 1

    print(f"Opened: {camera.description()}")

    try:
        import cv2

        frame = None
        for attempt in range(10):
            frame = camera.read()
            if frame is not None:
                break
            print(f"Waiting for frame ({attempt + 1}/10)...")

        if frame is None:
            print("ERROR: No frame captured.")
            return 1

        cv2.imwrite(str(out), frame)
        h, w = frame.shape[:2]
        print(f"OK: Saved {w}x{h} image to {out}")
        return 0
    finally:
        camera.close()


if __name__ == "__main__":
    sys.exit(main())

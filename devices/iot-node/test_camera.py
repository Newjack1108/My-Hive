#!/usr/bin/env python3
"""Test Pi Camera / USB camera and save a snapshot."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config
from sensors.camera import create_camera, list_libcamera_cameras
from sensors.camera_tools import camera_list_command, run_list_cameras


def main() -> int:
    out = Path(__file__).parent / "logs" / "camera_test.jpg"
    out.parent.mkdir(parents=True, exist_ok=True)

    env_file = Path(__file__).parent / ".env"
    print(f".env file: {'found' if env_file.exists() else 'MISSING'}")
    print(f"Camera backend: {config.BEE_CAMERA_BACKEND}")
    print(f"Camera num: {config.BEE_CAMERA_NUM}")
    print(f"Resolution: {config.BEE_CAMERA_WIDTH}x{config.BEE_CAMERA_HEIGHT}")

    cameras = list_libcamera_cameras()
    print(f"picamera2 detected {len(cameras)} camera(s): {cameras}")

    list_cmd = camera_list_command()
    tool_name = list_cmd[0] if list_cmd else "rpicam-hello / libcamera-hello"
    print(f"\n--- {tool_name} --list-cameras ---")
    code, output = run_list_cameras()
    print(output or "(no output)")
    if code == 127:
        print("\nInstall camera tools:")
        print("  sudo apt update")
        print("  sudo apt install -y rpicam-apps python3-picamera2")

    if not cameras:
        print("\nNo camera detected. Try:")
        print("  1. sudo apt install -y rpicam-apps")
        print("  2. Reseat ribbon cable (Pi OFF), silver contacts toward HDMI")
        print("  3. sudo reboot")
        print(f"  4. {tool_name} --list-cameras")
        print("  5. On Pi 5 dual CSI: IOT_BEE_CAMERA_NUM=1 in .env")

    camera = create_camera()
    if camera is None:
        print("\nERROR: Could not open any camera.")
        return 1

    print(f"\nOpened: {camera.description()}")

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

"""Helpers for Pi camera CLI tools (libcamera-hello / rpicam-hello)."""

import shutil
import subprocess


def camera_list_command() -> list[str] | None:
    """Return argv to list cameras, or None if no tool is installed."""
    if shutil.which("rpicam-hello"):
        return ["rpicam-hello", "--list-cameras"]
    if shutil.which("libcamera-hello"):
        return ["libcamera-hello", "--list-cameras"]
    return None


def camera_still_command(output_path: str) -> list[str] | None:
    """Return argv to capture a still image, or None."""
    if shutil.which("rpicam-still"):
        return ["rpicam-still", "-o", output_path, "--nopreview"]
    if shutil.which("libcamera-still"):
        return ["libcamera-still", "-o", output_path, "--nopreview"]
    return None


def run_list_cameras(timeout: int = 15) -> tuple[int, str]:
    """Run system camera list tool. Returns (exit_code, combined output)."""
    cmd = camera_list_command()
    if cmd is None:
        return 127, "Neither rpicam-hello nor libcamera-hello is installed.\nInstall: sudo apt install rpicam-apps"

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        output = ((result.stdout or "") + (result.stderr or "")).strip()
        return result.returncode, output
    except subprocess.TimeoutExpired:
        return 124, f"{' '.join(cmd)} timed out"
    except OSError as exc:
        return 1, str(exc)

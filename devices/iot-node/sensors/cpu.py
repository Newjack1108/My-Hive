"""Raspberry Pi CPU temperature via vcgencmd."""

import subprocess


def read_cpu() -> dict | None:
    """Return cpu_temp_c or None if unavailable (non-Pi / missing vcgencmd)."""
    try:
        result = subprocess.check_output(
            ["vcgencmd", "measure_temp"],
            stderr=subprocess.DEVNULL,
            timeout=5,
        ).decode()
        temp_c = float(result.replace("temp=", "").replace("'C\n", "").replace("'C", ""))
        return {"cpu_temp_c": round(temp_c, 1)}
    except (subprocess.CalledProcessError, FileNotFoundError, ValueError, subprocess.TimeoutExpired):
        return None

"""
IoT node configuration.

Loads .env from the project directory, then reads environment variables.
"""

import json
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


def _load_env_file() -> None:
    """Load .env into os.environ (does not override existing env vars)."""
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return
    try:
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                key, sep, value = line.partition("=")
                if not sep:
                    continue
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except OSError:
        pass


_load_env_file()

# --- API ---
API_URL = os.getenv(
    "IOT_API_URL",
    "https://my-hive-production.up.railway.app/api/device-heartbeat",
)
DEVICE_KEY = os.getenv("IOT_DEVICE_KEY", "pi_test_12345")
REQUEST_TIMEOUT_SECONDS = int(os.getenv("IOT_REQUEST_TIMEOUT", "30"))

# --- Device identity ---
DEVICE_ID = os.getenv("IOT_DEVICE_ID", "pi-001")
DEVICE_NAME = os.getenv("IOT_DEVICE_NAME", "Hive 1 Entrance Node")

# --- Paths ---
LOGS_DIR = BASE_DIR / "logs"
CALIBRATION_FILE = BASE_DIR / "calibration.json"
BEE_COUNTS_FILE = Path(os.getenv("IOT_BEE_COUNTS_FILE", "/tmp/bee_counts.json"))
FAILED_PAYLOAD_QUEUE = BASE_DIR / "logs" / "pending_payload.json"

# --- Temperature (DS18B20 1-Wire) ---
INTERNAL_PROBE_ID = os.getenv("IOT_INTERNAL_PROBE_ID", "")
EXTERNAL_PROBE_ID = os.getenv("IOT_EXTERNAL_PROBE_ID", "")

USE_BME280_EXTERNAL = os.getenv("IOT_USE_BME280_EXTERNAL", "false").lower() == "true"
BME280_I2C_ADDRESS = int(os.getenv("IOT_BME280_ADDRESS", "0x76"), 0)

# --- Weight (HX711) ---
WEIGHT_ENABLED = os.getenv("IOT_WEIGHT_ENABLED", "false").lower() == "true"
HX711_DOUT_PIN = int(os.getenv("IOT_HX711_DOUT", "5"))
HX711_SCK_PIN = int(os.getenv("IOT_HX711_SCK", "6"))
WEIGHT_SAMPLE_COUNT = int(os.getenv("IOT_WEIGHT_SAMPLES", "10"))
WEIGHT_STABLE_VARIANCE_KG = float(os.getenv("IOT_WEIGHT_STABLE_VARIANCE", "0.05"))

# --- Bee counter ---
BEES_ENABLED = os.getenv("IOT_BEES_ENABLED", "false").lower() == "true"
BEE_WINDOW_SECONDS = int(os.getenv("IOT_BEE_WINDOW_SECONDS", "300"))

BEE_CAMERA_BACKEND = os.getenv("IOT_BEE_CAMERA_BACKEND", "auto")
BEE_CAMERA_NUM = int(os.getenv("IOT_BEE_CAMERA_NUM", "0"))
BEE_CAMERA_INDEX = int(os.getenv("IOT_BEE_CAMERA_INDEX", "0"))
BEE_CAMERA_WIDTH = int(os.getenv("IOT_BEE_CAMERA_WIDTH", "640"))
BEE_CAMERA_HEIGHT = int(os.getenv("IOT_BEE_CAMERA_HEIGHT", "480"))
BEE_CAMERA_FPS = int(os.getenv("IOT_BEE_CAMERA_FPS", "15"))

BEE_ROI_X = float(os.getenv("IOT_BEE_ROI_X", "0.25"))
BEE_ROI_Y = float(os.getenv("IOT_BEE_ROI_Y", "0.3"))
BEE_ROI_W = float(os.getenv("IOT_BEE_ROI_W", "0.5"))
BEE_ROI_H = float(os.getenv("IOT_BEE_ROI_H", "0.5"))
BEE_LINE_Y_FRAC = float(os.getenv("IOT_BEE_LINE_Y", "0.5"))
BEE_MIN_CONTOUR_AREA = int(os.getenv("IOT_BEE_MIN_AREA", "80"))
BEE_MAX_CONTOUR_AREA = int(os.getenv("IOT_BEE_MAX_AREA", "3000"))

BEE_USE_YOLO = os.getenv("IOT_BEE_USE_YOLO", "false").lower() == "true"
BEE_YOLO_MODEL = os.getenv("IOT_BEE_YOLO_MODEL", "yolov8n.pt")
BEE_YOLO_CONFIDENCE = float(os.getenv("IOT_BEE_YOLO_CONF", "0.35"))


def load_calibration() -> dict:
    """Load HX711 calibration from calibration.json."""
    defaults = {
        "scale_factor": 1.0,
        "tare_offset": 0.0,
        "reference_unit": 1.0,
    }
    if not CALIBRATION_FILE.exists():
        return defaults
    try:
        with open(CALIBRATION_FILE, encoding="utf-8") as f:
            data = json.load(f)
        return {**defaults, **data}
    except (json.JSONDecodeError, OSError):
        return defaults


def save_calibration(data: dict) -> None:
    """Persist HX711 calibration."""
    CALIBRATION_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CALIBRATION_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

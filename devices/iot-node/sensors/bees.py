"""Read bee traffic counts from the bee_counter daemon state file."""

import json
import logging
from datetime import datetime, timezone

import config

logger = logging.getLogger(__name__)


def read_bee_counts() -> dict | None:
    """
    Read aggregated in/out counts from bee_counter state file.

    Returns None if bees disabled or state file missing/invalid.
    """
    if not config.BEES_ENABLED:
        return None

    path = config.BEE_COUNTS_FILE
    if not path.exists():
        return None

    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)

        return {
            "in_count": int(data.get("in_count", 0)),
            "out_count": int(data.get("out_count", 0)),
            "window_seconds": int(data.get("window_seconds", config.BEE_WINDOW_SECONDS)),
            "since": data.get("since") or datetime.now(timezone.utc).isoformat(),
        }
    except (json.JSONDecodeError, OSError, ValueError, TypeError) as exc:
        logger.warning("Failed to read bee counts from %s: %s", path, exc)
        return None


def reset_bee_counts_after_read() -> None:
    """Reset counters in state file after successful heartbeat include."""
    if not config.BEES_ENABLED or not config.BEE_COUNTS_FILE.exists():
        return

    try:
        with open(config.BEE_COUNTS_FILE, encoding="utf-8") as f:
            data = json.load(f)

        now = datetime.now(timezone.utc).isoformat()
        data["in_count"] = 0
        data["out_count"] = 0
        data["since"] = now
        data["last_reset"] = now

        with open(config.BEE_COUNTS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Failed to reset bee counts: %s", exc)

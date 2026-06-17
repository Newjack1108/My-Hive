"""HX711 load cell weight reading with stability detection."""

import logging
import statistics

import config

logger = logging.getLogger(__name__)

_hx711 = None


def _get_hx711():
    """Lazy-init HX711 to avoid import/GPIO errors when weight is disabled."""
    global _hx711
    if _hx711 is not None:
        return _hx711
    if not config.WEIGHT_ENABLED:
        return None
    try:
        from hx711 import HX711

        hx = HX711(dout_pin=config.HX711_DOUT_PIN, pd_sck_pin=config.HX711_SCK_PIN)
        cal = config.load_calibration()
        hx.reset()
        ref = cal.get("scale_factor") or cal.get("reference_unit", 1.0)
        if ref and ref != 1.0:
            hx.set_reference_unit(ref)
        if cal.get("tare_offset") and hasattr(hx, "set_offset"):
            hx.set_offset(cal["tare_offset"])
        _hx711 = hx
        return _hx711
    except ImportError:
        logger.warning("hx711 not installed; weight sensor disabled")
        return None
    except (OSError, RuntimeError, ValueError) as exc:
        logger.warning("HX711 init failed: %s", exc)
        return None


def read_weight() -> dict | None:
    """
    Read hive weight in kg with weight_stable flag.

    Returns None if weight sensor is disabled or unreadable.
    """
    if not config.WEIGHT_ENABLED:
        return None

    hx = _get_hx711()
    if hx is None:
        return None

    try:
        samples: list[float] = []
        for _ in range(config.WEIGHT_SAMPLE_COUNT):
            raw = hx.get_weight(1)
            if raw is not None:
                samples.append(float(raw))
            hx.power_down()
            hx.power_up()

        if not samples:
            return None

        # Discard outliers beyond 1.5 IQR when we have enough samples
        if len(samples) >= 5:
            sorted_s = sorted(samples)
            q1 = sorted_s[len(sorted_s) // 4]
            q3 = sorted_s[(3 * len(sorted_s)) // 4]
            iqr = q3 - q1
            lo = q1 - 1.5 * iqr
            hi = q3 + 1.5 * iqr
            filtered = [s for s in samples if lo <= s <= hi]
            if filtered:
                samples = filtered

        weight_kg = round(statistics.mean(samples), 2)
        variance = statistics.pvariance(samples) if len(samples) > 1 else 0.0
        stable = variance <= config.WEIGHT_STABLE_VARIANCE_KG ** 2

        return {
            "weight_kg": max(0.0, weight_kg),
            "weight_stable": stable,
        }
    except (OSError, RuntimeError, ValueError, statistics.StatisticsError) as exc:
        logger.warning("Weight read failed: %s", exc)
        return None

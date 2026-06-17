#!/usr/bin/env python3
"""
Bee entrance counter daemon — runs continuously, writes counts to state file.

MVP: OpenCV background subtraction + centroid line crossing.
Phase 3b: Set IOT_BEE_USE_YOLO=true for YOLO-based detection (requires ultralytics).

Install as systemd service: deploy/systemd/bee-counter.service
"""

import json
import logging
import signal
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

_running = True


def _handle_signal(_signum, _frame):
    global _running
    _running = False


def _init_state() -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "in_count": 0,
        "out_count": 0,
        "window_seconds": config.BEE_WINDOW_SECONDS,
        "since": now,
        "last_updated": now,
    }


def _load_state() -> dict:
    path = config.BEE_COUNTS_FILE
    if path.exists():
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            for key in ("in_count", "out_count", "window_seconds", "since"):
                if key not in data:
                    data[key] = _init_state()[key]
            return data
        except (json.JSONDecodeError, OSError):
            pass
    return _init_state()


def _save_state(state: dict) -> None:
    state["last_updated"] = datetime.now(timezone.utc).isoformat()
    path = config.BEE_COUNTS_FILE
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)
    tmp.replace(path)


def _roi_slices(frame_h: int, frame_w: int) -> tuple[int, int, int, int]:
    x = int(frame_w * config.BEE_ROI_X)
    y = int(frame_h * config.BEE_ROI_Y)
    w = int(frame_w * config.BEE_ROI_W)
    h = int(frame_h * config.BEE_ROI_H)
    return x, y, w, h


class CentroidTracker:
    """Simple centroid tracker for line-crossing."""

    def __init__(self, max_disappeared: int = 15):
        self.next_id = 0
        self.objects: dict[int, tuple[int, int]] = {}
        self.disappeared: dict[int, int] = defaultdict(int)
        self.max_disappeared = max_disappeared
        self.prev_y: dict[int, float] = {}

    def register(self, cx: int, cy: int) -> int:
        oid = self.next_id
        self.next_id += 1
        self.objects[oid] = (cx, cy)
        self.prev_y[oid] = float(cy)
        return oid

    def deregister(self, oid: int) -> None:
        del self.objects[oid]
        self.disappeared.pop(oid, None)
        self.prev_y.pop(oid, None)

    def update(self, centroids: list[tuple[int, int]]) -> dict[int, tuple[int, int]]:
        if not centroids:
            for oid in list(self.objects.keys()):
                self.disappeared[oid] += 1
                if self.disappeared[oid] > self.max_disappeared:
                    self.deregister(oid)
            return self.objects

        if not self.objects:
            for cx, cy in centroids:
                self.register(cx, cy)
            return self.objects

        object_ids = list(self.objects.keys())
        object_centroids = list(self.objects.values())

        # Greedy nearest-neighbour assignment
        used_c = set()
        used_o = set()
        pairs: list[tuple[int, int, float]] = []
        for i, (ox, oy) in enumerate(object_centroids):
            for j, (cx, cy) in enumerate(centroids):
                dist = ((ox - cx) ** 2 + (oy - cy) ** 2) ** 0.5
                pairs.append((dist, i, j))
        pairs.sort()

        for _dist, i, j in pairs:
            if i in used_o or j in used_c:
                continue
            oid = object_ids[i]
            cx, cy = centroids[j]
            self.objects[oid] = (cx, cy)
            self.disappeared[oid] = 0
            used_o.add(i)
            used_c.add(j)

        for i, oid in enumerate(object_ids):
            if i not in used_o:
                self.disappeared[oid] += 1
                if self.disappeared[oid] > self.max_disappeared:
                    self.deregister(oid)

        for j, (cx, cy) in enumerate(centroids):
            if j not in used_c:
                self.register(cx, cy)

        return self.objects


def _check_line_cross(
    tracker: CentroidTracker,
    line_y: int,
    state: dict,
) -> None:
    """Increment in/out when centroid crosses counting line."""
    for oid, (_cx, cy) in tracker.objects.items():
        prev = tracker.prev_y.get(oid)
        if prev is None:
            tracker.prev_y[oid] = float(cy)
            continue
        if prev < line_y <= cy:
            state["out_count"] += 1
        elif prev > line_y >= cy:
            state["in_count"] += 1
        tracker.prev_y[oid] = float(cy)


def _detect_centroids_yolo(roi_frame, model) -> list[tuple[int, int]]:
    """YOLO detection — class-agnostic blob centres in ROI (Phase 3b)."""
    results = model(roi_frame, conf=config.BEE_YOLO_CONFIDENCE, verbose=False)
    centroids = []
    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            cx = int((x1 + x2) / 2)
            cy = int((y1 + y2) / 2)
            area = (x2 - x1) * (y2 - y1)
            if config.BEE_MIN_CONTOUR_AREA <= area <= config.BEE_MAX_CONTOUR_AREA:
                centroids.append((cx, cy))
    return centroids


def run_counter() -> int:
    import cv2
    import numpy as np

    if not config.BEES_ENABLED:
        logger.error("Set IOT_BEES_ENABLED=true to run bee counter")
        return 1

    cap = cv2.VideoCapture(config.BEE_CAMERA_INDEX)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, config.BEE_CAMERA_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, config.BEE_CAMERA_HEIGHT)
    cap.set(cv2.CAP_PROP_FPS, config.BEE_CAMERA_FPS)

    if not cap.isOpened():
        logger.error("Could not open camera index %s", config.BEE_CAMERA_INDEX)
        return 1

    subtractor = cv2.createBackgroundSubtractorMOG2(
        history=500,
        varThreshold=16,
        detectShadows=True,
    )
    tracker = CentroidTracker()
    state = _load_state()
    yolo_model = None

    if config.BEE_USE_YOLO:
        try:
            from ultralytics import YOLO

            yolo_model = YOLO(config.BEE_YOLO_MODEL)
            logger.info("YOLO mode enabled: %s", config.BEE_YOLO_MODEL)
        except ImportError:
            logger.warning("ultralytics not installed; falling back to MOG2")

    logger.info("Bee counter started (camera %s)", config.BEE_CAMERA_INDEX)
    frame_interval = 1.0 / max(config.BEE_CAMERA_FPS, 1)
    last_save = time.monotonic()

    while _running:
        ret, frame = cap.read()
        if not ret:
            logger.warning("Frame read failed; retrying...")
            time.sleep(0.5)
            continue

        fh, fw = frame.shape[:2]
        rx, ry, rw, rh = _roi_slices(fh, fw)
        roi = frame[ry : ry + rh, rx : rx + rw]
        line_y = int(rh * config.BEE_LINE_Y_FRAC)

        if yolo_model is not None:
            centroids = _detect_centroids_yolo(roi, yolo_model)
        else:
            fg = subtractor.apply(roi)
            fg = cv2.threshold(fg, 200, 255, cv2.THRESH_BINARY)[1]
            kernel = np.ones((3, 3), np.uint8)
            fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, kernel, iterations=2)
            contours, = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            centroids = []
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area < config.BEE_MIN_CONTOUR_AREA or area > config.BEE_MAX_CONTOUR_AREA:
                    continue
                m = cv2.moments(cnt)
                if m["m00"] == 0:
                    continue
                centroids.append((int(m["m10"] / m["m00"]), int(m["m01"] / m["m00"])))

        tracker.update(centroids)
        _check_line_cross(tracker, line_y, state)

        if time.monotonic() - last_save >= 2.0:
            _save_state(state)
            last_save = time.monotonic()

        time.sleep(frame_interval)

    cap.release()
    _save_state(state)
    logger.info("Bee counter stopped")
    return 0


def main() -> int:
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)
    return run_counter()


if __name__ == "__main__":
    sys.exit(main())

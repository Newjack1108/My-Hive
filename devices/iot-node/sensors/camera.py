"""Camera capture for Pi Camera Module (picamera2) and USB cameras (OpenCV)."""

import logging
from abc import ABC, abstractmethod

import config

logger = logging.getLogger(__name__)


def list_libcamera_cameras() -> list[dict]:
    """Return libcamera camera info dicts, or empty list if unavailable."""
    try:
        from picamera2 import Picamera2

        return Picamera2.global_camera_info()
    except Exception as exc:
        logger.debug("global_camera_info failed: %s", exc)
        return []


class CameraSource(ABC):
    @abstractmethod
    def open(self) -> bool:
        pass

    @abstractmethod
    def read(self):
        """Return BGR numpy frame or None."""

    @abstractmethod
    def close(self) -> None:
        pass

    @abstractmethod
    def description(self) -> str:
        pass


class Picamera2Source(CameraSource):
    """Raspberry Pi Camera Module via libcamera / picamera2."""

    def __init__(self, camera_num: int | None = None) -> None:
        self._picam = None
        self._camera_num = camera_num if camera_num is not None else config.BEE_CAMERA_NUM

    def open(self) -> bool:
        try:
            from picamera2 import Picamera2

            cameras = list_libcamera_cameras()
            if not cameras:
                logger.error(
                    "No libcamera cameras detected. Check ribbon cable, then run: "
                    "rpicam-hello --list-cameras  (or: sudo apt install rpicam-apps; reboot)"
                )
                return False

            logger.info("libcamera cameras: %s", cameras)

            if self._camera_num >= len(cameras):
                logger.error(
                    "Camera num %s not available (%s camera(s) found). "
                    "Try IOT_BEE_CAMERA_NUM=0 or 1 on dual-CSI Pi boards.",
                    self._camera_num,
                    len(cameras),
                )
                return False

            self._picam = Picamera2(self._camera_num)
            cfg = self._picam.create_preview_configuration(
                main={
                    "size": (config.BEE_CAMERA_WIDTH, config.BEE_CAMERA_HEIGHT),
                    "format": "RGB888",
                }
            )
            self._picam.configure(cfg)
            self._picam.start()
            logger.info(
                "Pi Camera %s opened via picamera2 (%sx%s)",
                self._camera_num,
                config.BEE_CAMERA_WIDTH,
                config.BEE_CAMERA_HEIGHT,
            )
            return True
        except ImportError:
            logger.warning("picamera2 not available — install: sudo apt install python3-picamera2")
            return False
        except Exception as exc:
            logger.error("Failed to open Pi Camera %s: %s", self._camera_num, exc)
            return False

    def read(self):
        if self._picam is None:
            return None
        try:
            import cv2

            frame = self._picam.capture_array()
            if frame is None:
                return None
            return cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        except Exception as exc:
            logger.warning("Pi Camera frame read failed: %s", exc)
            return None

    def close(self) -> None:
        if self._picam is not None:
            try:
                self._picam.stop()
            except Exception:
                pass
            self._picam = None

    def description(self) -> str:
        return f"picamera2:{self._camera_num}"


class OpenCVSource(CameraSource):
    """USB camera or V4L2 device via OpenCV VideoCapture."""

    def __init__(self) -> None:
        self._cap = None

    def open(self) -> bool:
        import cv2

        self._cap = cv2.VideoCapture(config.BEE_CAMERA_INDEX)
        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, config.BEE_CAMERA_WIDTH)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, config.BEE_CAMERA_HEIGHT)
        self._cap.set(cv2.CAP_PROP_FPS, config.BEE_CAMERA_FPS)

        if not self._cap.isOpened():
            logger.error("Could not open camera index %s", config.BEE_CAMERA_INDEX)
            self._cap = None
            return False

        logger.info("Camera opened via OpenCV (index %s)", config.BEE_CAMERA_INDEX)
        return True

    def read(self):
        if self._cap is None:
            return None
        ret, frame = self._cap.read()
        return frame if ret else None

    def close(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None

    def description(self) -> str:
        return f"opencv:{config.BEE_CAMERA_INDEX}"


def create_camera() -> CameraSource | None:
    """
    Open camera using configured backend.

    IOT_BEE_CAMERA_BACKEND:
      - picamera2: Pi Camera Module only
      - opencv: USB / V4L2 index
      - auto: try picamera2 first, then opencv
    """
    backend = config.BEE_CAMERA_BACKEND.lower()

    if backend in ("picamera2", "auto"):
        cameras = list_libcamera_cameras()
        nums_to_try = [config.BEE_CAMERA_NUM]
        if backend == "auto" and cameras:
            nums_to_try = list(range(len(cameras)))

        for num in nums_to_try:
            cam = Picamera2Source(camera_num=num)
            if cam.open():
                return cam

        if backend == "picamera2":
            return None

    cam = OpenCVSource()
    if cam.open():
        return cam
    return None

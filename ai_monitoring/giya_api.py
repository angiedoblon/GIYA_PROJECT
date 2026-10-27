
import cv2
import re
import time
import threading
from datetime import datetime, timezone
from collections import deque
from pathlib import Path

import easyocr
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from ultralytics import YOLO

# ---------------- SETTINGS ----------------

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = (
    BASE_DIR
    / "runs"
    / "detect"
    / "runs"
    / "detect"
    / "giya_license_plate_v2-2"
    / "weights"
    / "best.pt"
)

STREAM_URL = "rtsp://127.0.0.1:8554/tapo"
VEHICLE_MODEL_PATH = BASE_DIR / "yolo26n.pt"
VEHICLE_CLASSES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
VEHICLE_CONFIDENCE = 0.25

IMAGE_SIZE = 416
CONFIDENCE = 0.35
DETECTION_INTERVAL = 0.25
OCR_INTERVAL = 1.0
DUPLICATE_SECONDS = 10
JPEG_QUALITY = 70

app = FastAPI(title="GIYA License Plate API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

detector = None  # trained GIYA license-plate detector
vehicle_detector = None  # COCO vehicle detector (yolo26n.pt)
reader = None
camera = None

stop_event = threading.Event()

# Raw camera frame and annotated output are kept separately.
raw_frame = None
latest_frame = None

raw_lock = threading.Lock()
output_lock = threading.Lock()
logs_lock = threading.Lock()

access_logs = deque(maxlen=200)
last_seen = {}

status = {
    "camera_connected": False,
    "running": False,
}

# Remember the latest recognized characters for each detected plate.
plate_memory = {}


# ---------------- CAMERA READER ----------------

def camera_reader():
    global camera, raw_frame

    while not stop_event.is_set():
        if camera is None or not camera.isOpened():
            camera = cv2.VideoCapture(
                STREAM_URL,
                cv2.CAP_FFMPEG,
            )

            camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            if not camera.isOpened():
                status["camera_connected"] = False
                camera.release()
                camera = None
                time.sleep(1)
                continue

        ok, frame = camera.read()

        if not ok:
            status["camera_connected"] = False

            camera.release()
            camera = None

            time.sleep(0.2)
            continue

        status["camera_connected"] = True

        # Always replace the old frame with the newest one.
        with raw_lock:
            raw_frame = frame


# ---------------- PLATE RECOGNITION ----------------

def recognition_worker():
    global latest_frame

    last_detection_time = 0
    last_ocr_time = 0
    detections = []
    vehicle_detections = []

    while not stop_event.is_set():

        # Copy the newest camera frame without waiting for AI.
        with raw_lock:
            frame = (
                raw_frame.copy()
                if raw_frame is not None
                else None
            )

        if frame is None:
            time.sleep(0.02)
            continue

        now = time.time()

        # Run detection on a schedule, not on every captured frame.
        if now - last_detection_time >= DETECTION_INTERVAL:
            last_detection_time = now

            try:
                results = detector.predict(
                    source=frame,
                    imgsz=IMAGE_SIZE,
                    conf=CONFIDENCE,
                    verbose=False,
                )

                new_detections = []

                for result in results:
                    for box in result.boxes:
                        x1, y1, x2, y2 = map(
                            int,
                            box.xyxy[0].tolist(),
                        )

                        height, width = frame.shape[:2]

                        x1 = max(0, min(width - 1, x1))
                        x2 = max(0, min(width, x2))
                        y1 = max(0, min(height - 1, y1))
                        y2 = max(0, min(height, y2))

                        if x2 <= x1 or y2 <= y1:
                            continue

                        crop = frame[y1:y2, x1:x2]

                        if crop.size == 0:
                            continue

                        # Keep the previous recognized characters
                        # while waiting for a new OCR result.
                        key = (x1, y1, x2, y2)
                        label = plate_memory.get(
                            key,
                            "Reading plate...",
                        )

                        new_detections.append(
                            [x1, y1, x2, y2, label]
                        )

                        # OCR runs separately from camera capture.
                        if now - last_ocr_time >= OCR_INTERVAL:
                            last_ocr_time = now

                            try:
                                enlarged = cv2.resize(
                                    crop,
                                    None,
                                    fx=2,
                                    fy=2,
                                    interpolation=cv2.INTER_CUBIC,
                                )

                                gray = cv2.cvtColor(
                                    enlarged,
                                    cv2.COLOR_BGR2GRAY,
                                )

                                texts = reader.readtext(
                                    gray,
                                    detail=1,
                                    allowlist=(
                                        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                                        "0123456789"
                                    ),
                                )

                                candidate = "".join(
                                    item[1] for item in texts
                                )

                                candidate = re.sub(
                                    r"[^A-Z0-9]",
                                    "",
                                    candidate.upper(),
                                )

                                if 5 <= len(candidate) <= 8:
                                    label = candidate
                                    new_detections[-1][4] = label
                                    plate_memory[key] = label

                                    # Log only once per plate per interval.
                                    if (
                                        now - last_seen.get(
                                            candidate, 0
                                        )
                                        >= DUPLICATE_SECONDS
                                    ):
                                        last_seen[candidate] = now

                                        log = {
                                            "id": int(now * 1000),
                                            "plate_number": candidate,
                                            "status": "detected",
                                            "timestamp": datetime.now(
                                                timezone.utc
                                            ).isoformat(),
                                        }

                                        with logs_lock:
                                            access_logs.appendleft(log)

                                        print(
                                            "Recognized plate:",
                                            candidate,
                                        )

                            except Exception as exc:
                                print("OCR error:", exc)

                detections = new_detections

                # Detect vehicles on the same camera frame. These boxes are
                # drawn into the same annotated stream shown by the website.
                vehicle_results = vehicle_detector.track(
                    source=frame,
                    imgsz=IMAGE_SIZE,
                    conf=VEHICLE_CONFIDENCE,
                    classes=list(VEHICLE_CLASSES.keys()),
                    persist=True,
                    tracker="bytetrack.yaml",
                    verbose=False,
                )

                new_vehicle_detections = []
                height, width = frame.shape[:2]
                for vehicle_result in vehicle_results:
                    if vehicle_result.boxes is None:
                        continue

                    for vehicle_box in vehicle_result.boxes:
                        x1, y1, x2, y2 = map(
                            int, vehicle_box.xyxy[0].tolist()
                        )
                        x1 = max(0, min(width - 1, x1))
                        x2 = max(0, min(width, x2))
                        y1 = max(0, min(height - 1, y1))
                        y2 = max(0, min(height, y2))
                        if x2 <= x1 or y2 <= y1:
                            continue

                        class_id = int(vehicle_box.cls[0].item())
                        confidence = float(vehicle_box.conf[0].item())
                        track_id = (
                            int(vehicle_box.id[0].item())
                            if vehicle_box.id is not None
                            else None
                        )
                        vehicle_name = VEHICLE_CLASSES.get(
                            class_id, vehicle_result.names.get(class_id, "vehicle")
                        )
                        label = f"{vehicle_name.upper()} {confidence:.0%}"
                        if track_id is not None:
                            label += f" | ID {track_id}"

                        new_vehicle_detections.append(
                            (x1, y1, x2, y2, label)
                        )

                vehicle_detections = new_vehicle_detections

            except Exception as exc:
                print("Detection error:", exc)

        # Fetch the freshest frame again before drawing.
        with raw_lock:
            display_frame = (
                raw_frame.copy()
                if raw_frame is not None
                else None
            )

        if display_frame is None:
            continue

        # Draw vehicle detections first, then license-plate boxes on top.
        for x1, y1, x2, y2, vehicle_label in vehicle_detections:
            cv2.rectangle(
                display_frame,
                (x1, y1),
                (x2, y2),
                (255, 180, 0),
                2,
            )
            cv2.putText(
                display_frame,
                vehicle_label,
                (x1, max(y1 - 10, 25)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 180, 0),
                2,
                cv2.LINE_AA,
            )

        # Draw the latest available license-plate detections.
        for x1, y1, x2, y2, plate in detections:
            cv2.rectangle(
                display_frame,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2,
            )

            label_y = max(y1 - 10, 25)

            cv2.putText(
                display_frame,
                plate,
                (x1, label_y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 0),
                2,
                cv2.LINE_AA,
            )

        with output_lock:
            latest_frame = display_frame

        # Prevent the worker from spinning unnecessarily.
        time.sleep(0.005)


# ---------------- API LIFECYCLE ----------------

@app.on_event("startup")
def start_reader():
    global detector, vehicle_detector, reader

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"YOLO model not found: {MODEL_PATH}"
        )

    if not VEHICLE_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Vehicle YOLO model not found: {VEHICLE_MODEL_PATH}. "
            "Place yolo26n.pt in the same folder as giya_api.py."
        )

    print("Loading GIYA license-plate YOLO model...")
    detector = YOLO(str(MODEL_PATH))

    print("Loading vehicle YOLO model...")
    vehicle_detector = YOLO(str(VEHICLE_MODEL_PATH))

    print("Loading EasyOCR...")
    reader = easyocr.Reader(["en"], gpu=False)

    stop_event.clear()
    status["running"] = True

    threading.Thread(
        target=camera_reader,
        daemon=True,
        name="GIYA-Camera",
    ).start()

    threading.Thread(
        target=recognition_worker,
        daemon=True,
        name="GIYA-Recognition",
    ).start()

    print("GIYA camera and recognition workers started.")


@app.on_event("shutdown")
def stop_reader():
    stop_event.set()

    global camera

    if camera is not None:
        camera.release()
        camera = None


# ---------------- HEALTH AND LOGS ----------------

@app.get("/health")
def health():
    return {
        "ok": True,
        "running": status["running"],
        "camera_connected": status["camera_connected"],
    }


@app.get("/access-logs")
def get_access_logs():
    with logs_lock:
        return list(access_logs)


# ---------------- LIVE ANNOTATED VIDEO ----------------

def generate_video():
    while not stop_event.is_set():
        with output_lock:
            frame = (
                latest_frame.copy()
                if latest_frame is not None
                else None
            )

        if frame is None:
            time.sleep(0.02)
            continue

        ok, buffer = cv2.imencode(
            ".jpg",
            frame,
            [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY],
        )

        if ok:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Cache-Control: no-cache\r\n\r\n"
                + buffer.tobytes()
                + b"\r\n"
            )

        time.sleep(0.01)


@app.get("/video-feed")
def video_feed():
    return StreamingResponse(
        generate_video(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
        },
    )

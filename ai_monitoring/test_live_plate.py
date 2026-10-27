
import os
import time
import threading
from collections import Counter, deque

import cv2
import easyocr
from ultralytics import YOLO

# =================================
# CONFIGURATION
# =================================

MODEL_PATH = r"runs\detect\runs\license_plate\train1\weights\best.pt"
RTSP_URL = "rtsp://127.0.0.1:8554/tapo"

CONFIDENCE = 0.30
IMAGE_SIZE = 640
OCR_SCALE = 3

# Process fewer frames to reduce CPU workload.
DETECT_EVERY = 2
OCR_EVERY = 4

os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"


# =================================
# LATEST-FRAME CAMERA READER
# =================================

class CameraReader:
    def __init__(self, url):
        self.url = url
        self.cap = None
        self.frame = None
        self.lock = threading.Lock()
        self.running = False
        self.thread = None

    def start(self):
        self.cap = cv2.VideoCapture(
            self.url, cv2.CAP_FFMPEG
        )
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        if not self.cap.isOpened():
            self.cap.release()
            self.cap = None
            return False

        self.running = True
        self.thread = threading.Thread(
            target=self.update,
            daemon=True
        )
        self.thread.start()
        return True

    def update(self):
        while self.running:
            if self.cap is None or not self.cap.isOpened():
                time.sleep(0.1)
                continue

            ret, frame = self.cap.read()

            if ret and frame is not None:
                with self.lock:
                    self.frame = frame
            else:
                time.sleep(0.05)

    def read(self):
        with self.lock:
            if self.frame is None:
                return None
            return self.frame.copy()

    def stop(self):
        self.running = False

        if self.thread is not None:
            self.thread.join(timeout=2)

        if self.cap is not None:
            self.cap.release()


# =================================
# LOAD MODELS
# =================================

print("Loading YOLO model...")
model = YOLO(MODEL_PATH)

print("Loading EasyOCR...")
reader = easyocr.Reader(["en"], gpu=False)

camera = CameraReader(RTSP_URL)

if not camera.start():
    print("ERROR: Cannot open RTSP stream.")
    print("Check that MediaMTX and the Tapo camera are running.")
    raise SystemExit(1)

print("GIYA recognition started. Press Q to quit.")

frame_count = 0
last_boxes = []
last_ocr_frame = -OCR_EVERY
plate_history = deque(maxlen=7)
stable_text = ""


# =================================
# LICENSE PLATE PREPROCESSING
# =================================

def read_plate(plate):
    if plate.size == 0:
        return ""

    # Enlarge the plate crop.
    enlarged = cv2.resize(
        plate,
        None,
        fx=OCR_SCALE,
        fy=OCR_SCALE,
        interpolation=cv2.INTER_CUBIC
    )

    gray = cv2.cvtColor(
        enlarged, cv2.COLOR_BGR2GRAY
    )

    # Improve local contrast.
    gray = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8)
    ).apply(gray)

    gray = cv2.bilateralFilter(
        gray, 5, 50, 50
    )

    results = reader.readtext(
        gray,
        allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        detail=1,
        paragraph=False,
        text_threshold=0.5,
        low_text=0.3,
        contrast_ths=0.1
    )

    # Keep the order returned by OCR and remove spaces/hyphens.
    fragments = [
        item[1].upper().replace(" ", "").replace("-", "")
        for item in results
        if item[2] >= 0.35
    ]

    return "".join(fragments)


# =================================
# MAIN LOOP
# =================================

try:
    while True:
        frame = camera.read()

        if frame is None:
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
            time.sleep(0.01)
            continue

        frame_count += 1
        height, width = frame.shape[:2]

        # Run YOLO every few frames to reduce CPU use.
        if frame_count % DETECT_EVERY == 0:
            results = model.predict(
                source=frame,
                conf=CONFIDENCE,
                imgsz=IMAGE_SIZE,
                verbose=False
            )

            last_boxes = []

            for box in results[0].boxes:
                x1, y1, x2, y2 = map(
                    int, box.xyxy[0].tolist()
                )

                x1 = max(0, x1)
                y1 = max(0, y1)
                x2 = min(width, x2)
                y2 = min(height, y2)

                if x2 <= x1 or y2 <= y1:
                    continue

                last_boxes.append((x1, y1, x2, y2))

        display = frame.copy()

        # Run OCR periodically, rather than on every frame.
        if (
            last_boxes
            and frame_count - last_ocr_frame >= OCR_EVERY
        ):
            x1, y1, x2, y2 = last_boxes[0]
            plate = frame[y1:y2, x1:x2]

            text = read_plate(plate)
            last_ocr_frame = frame_count

            if text:
                plate_history.append(text)

                # Use the most frequently read result.
                stable_text = Counter(
                    plate_history
                ).most_common(1)[0][0]

        # Draw current detections and latest OCR result.
        for x1, y1, x2, y2 in last_boxes:
            cv2.rectangle(
                display,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2
            )

            label = stable_text or "Reading plate..."
            label_y = max(0, y1 - 35)
            label_x2 = min(width, x1 + 400)

            cv2.rectangle(
                display,
                (x1, label_y),
                (label_x2, y1),
                (0, 255, 0),
                -1
            )

            cv2.putText(
                display,
                label,
                (x1 + 5, max(20, y1 - 10)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 0, 0),
                2
            )

        cv2.imshow(
            "GIYA - License Plate Recognition",
            display
        )

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

finally:
    camera.stop()
    cv2.destroyAllWindows()
    print("GIYA recognition stopped.")
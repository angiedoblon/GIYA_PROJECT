import cv2
import easyocr
import re
import time
import threading
from ultralytics import YOLO

# ==========================================
# CONFIGURATION
# ==========================================

MODEL_PATH = "exp.pt"
RTSP_URL = "rtsp://localhost:8554/tapo"

YOLO_CONFIDENCE = 0.25
YOLO_IMAGE_SIZE = 640
OCR_CONFIDENCE = 0.20

# Run OCR on a detected plate at most once per interval
OCR_INTERVAL = 0.7

# ==========================================
# LOAD MODELS
# ==========================================

print("Loading license plate detector...")
model = YOLO(MODEL_PATH)

print("Loading EasyOCR...")
reader = easyocr.Reader(["en"], gpu=False)

print("===================================")
print("GIYA LICENSE PLATE RECOGNITION")
print("===================================")

# ==========================================
# CONNECT TO MEDIAMTX
# ==========================================

cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

if not cap.isOpened():
    raise RuntimeError(
        "Could not connect to MediaMTX. "
        "Check that MediaMTX is running and the tapo path is available."
    )

print("Camera connected.")
print("Press Q to quit.")

# ==========================================
# LATEST-FRAME CAPTURE
# ==========================================

latest_frame = None
frame_lock = threading.Lock()
stop_capture = threading.Event()


def capture_frames():
    global latest_frame

    while not stop_capture.is_set():
        success, frame = cap.read()

        if not success:
            time.sleep(0.02)
            continue

        with frame_lock:
            latest_frame = frame


capture_thread = threading.Thread(
    target=capture_frames,
    daemon=True
)
capture_thread.start()

# ==========================================
# OCR HELPER
# ==========================================

last_ocr_time = {}
last_printed_text = {}


def read_plate(plate_crop):
    # Enlarge the plate crop for OCR
    height, width = plate_crop.shape[:2]

    if height == 0 or width == 0:
        return ""

    scale = max(2, min(4, 160 // max(height, 1)))

    plate_crop = cv2.resize(
        plate_crop,
        (width * scale, height * scale),
        interpolation=cv2.INTER_CUBIC
    )

    # Improve contrast
    gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    # OCR reads the enlarged grayscale plate
    ocr_results = reader.readtext(
        gray,
        detail=1,
        paragraph=False,
        allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    )

    accepted = []

    for detection in ocr_results:
        text = detection[1].upper()
        confidence = float(detection[2])

        # Remove spaces and punctuation
        text = re.sub(r"[^A-Z0-9]", "", text)

        if confidence >= OCR_CONFIDENCE and text:
            accepted.append(text)

    return "".join(accepted)


# ==========================================
# PROCESS LIVE CAMERA
# ==========================================

try:
    while True:
        with frame_lock:
            frame = (
                latest_frame.copy()
                if latest_frame is not None
                else None
            )

        if frame is None:
            time.sleep(0.01)
            continue

        results = model.predict(
            source=frame,
            conf=YOLO_CONFIDENCE,
            imgsz=YOLO_IMAGE_SIZE,
            verbose=False
        )

        current_time = time.time()

        for result in results:
            if result.boxes is None:
                continue

            for box in result.boxes:
                x1, y1, x2, y2 = map(
                    int, box.xyxy[0].tolist()
                )

                confidence = float(box.conf[0])

                # Keep coordinates inside the frame
                height, width = frame.shape[:2]
                x1 = max(0, x1)
                y1 = max(0, y1)
                x2 = min(width, x2)
                y2 = min(height, y2)

                if x2 <= x1 or y2 <= y1:
                    continue

                # Expand crop slightly around plate
                pad_x = int((x2 - x1) * 0.05)
                pad_y = int((y2 - y1) * 0.12)

                cx1 = max(0, x1 - pad_x)
                cy1 = max(0, y1 - pad_y)
                cx2 = min(width, x2 + pad_x)
                cy2 = min(height, y2 + pad_y)

                plate_crop = frame[cy1:cy2, cx1:cx2]

                if plate_crop.size == 0:
                    continue

                # Avoid running OCR on every frame
                key = (x1 // 30, y1 // 30, x2 // 30, y2 // 30)
                last_time = last_ocr_time.get(key, 0)

                if current_time - last_time >= OCR_INTERVAL:
                    plate_text = read_plate(plate_crop)
                    last_ocr_time[key] = current_time

                    if plate_text:
                        previous = last_printed_text.get(key)

                        if previous != plate_text:
                            print(
                                f"PLATE: {plate_text} | "
                                f"YOLO CONF: {confidence:.2f}"
                            )
                            last_printed_text[key] = plate_text
                else:
                    plate_text = last_printed_text.get(key, "")

                # Draw bounding box
                cv2.rectangle(
                    frame,
                    (x1, y1),
                    (x2, y2),
                    (0, 255, 0),
                    2
                )

                label = (
                    f"{plate_text} ({confidence:.2f})"
                    if plate_text
                    else f"Reading plate... ({confidence:.2f})"
                )

                cv2.putText(
                    frame,
                    label,
                    (x1, max(25, y1 - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (0, 255, 0) if plate_text else (0, 255, 255),
                    2
                )

        cv2.imshow(
            "GIYA - License Plate Recognition",
            frame
        )

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

finally:
    stop_capture.set()
    capture_thread.join(timeout=2)
    cap.release()
    cv2.destroyAllWindows()

print("Camera stopped.")
import cv2
import easyocr
from ultralytics import YOLO

RTSP_URL = "rtsp://localhost:8554/tapo"
PLATE_MODEL = "ai_monitoring/exp.pt"
OUTPUT = "ai_monitoring/plate_test_result.jpg"

print("Loading license plate model...")
plate_model = YOLO(PLATE_MODEL)

print("Loading OCR...")
reader = easyocr.Reader(["en"], gpu=False)

print("Connecting to Tapo...")
cap = cv2.VideoCapture(RTSP_URL)

if not cap.isOpened():
    raise RuntimeError("Could not open Tapo RTSP stream.")

print("Camera connected!")

ret, frame = cap.read()
cap.release()

if not ret:
    raise RuntimeError("Could not read frame from camera.")

print("Frame received:", frame.shape)

print("Running license plate detection...")

results = plate_model.predict(
    source=frame,
    conf=0.15,
    imgsz=640,
    max_det=5,
    verbose=False
)

plate_count = 0

for result in results:

    if result.boxes is None:
        continue

    for box in result.boxes:

        plate_count += 1

        confidence = float(box.conf[0])

        x1, y1, x2, y2 = map(int, box.xyxy[0])

        # Keep coordinates inside image
        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = min(frame.shape[1], x2)
        y2 = min(frame.shape[0], y2)

        plate_crop = frame[y1:y2, x1:x2]

        plate_text = ""

        if plate_crop.size > 0:

            ocr_results = reader.readtext(
                plate_crop,
                allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
                detail=1,
                paragraph=False
            )

            if ocr_results:
                best = max(
                    ocr_results,
                    key=lambda item: float(item[2])
                )

                plate_text = best[1].upper()
                ocr_confidence = float(best[2])

                print(
                    f"PLATE: {plate_text} | "
                    f"OCR CONFIDENCE: {ocr_confidence:.2f}"
                )

        cv2.rectangle(
            frame,
            (x1, y1),
            (x2, y2),
            (0, 255, 0),
            3
        )

        label = f"PLATE {confidence:.2f}"

        if plate_text:
            label += f" | {plate_text}"

        cv2.putText(
            frame,
            label,
            (x1, max(30, y1 - 10)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2
        )

print()
print("================================")
print(f"PLATES DETECTED: {plate_count}")
print("================================")

cv2.imwrite(OUTPUT, frame)

print(f"Saved result to: {OUTPUT}")
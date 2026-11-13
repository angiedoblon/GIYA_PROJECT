
from pathlib import Path
import cv2
from ultralytics import YOLO

# Test files in the same folder as this script.
BASE_DIR = Path(__file__).resolve().parent
VIDEO_PATH = BASE_DIR / "parking_test.mp4"
MODEL_PATH = BASE_DIR / "yolo26n.pt"
OUTPUT_PATH = BASE_DIR / "parking_test_result.mp4"

VEHICLE_CLASSES = [1, 2, 3, 5, 7]
CONFIDENCE = 0.20
YOLO_IMAGE_SIZE = 416

if not VIDEO_PATH.exists():
    raise FileNotFoundError(
        f"Video not found: {VIDEO_PATH}\n"
        "Save your sample video as parking_test.mp4 "
        "inside the ai_monitoring folder."
    )

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"YOLO model not found: {MODEL_PATH}"
    )

print("Loading YOLO model...")
model = YOLO(str(MODEL_PATH))

print("Opening sample video...")
cap = cv2.VideoCapture(str(VIDEO_PATH))

if not cap.isOpened():
    raise RuntimeError("Could not open parking_test.mp4")

width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
source_fps = cap.get(cv2.CAP_PROP_FPS)

if source_fps <= 0:
    source_fps = 15.0

fourcc = cv2.VideoWriter_fourcc(*"mp4v")
writer = cv2.VideoWriter(
    str(OUTPUT_PATH),
    fourcc,
    source_fps,
    (width, height)
)

if not writer.isOpened():
    cap.release()
    raise RuntimeError("Could not create the output MP4.")

frame_count = 0

try:
    while True:
        ret, frame = cap.read()

        if not ret:
            break

        result = model.predict(
            frame,
            classes=VEHICLE_CLASSES,
            conf=CONFIDENCE,
            imgsz=YOLO_IMAGE_SIZE,
            verbose=False
        )[0]

        annotated = result.plot()
        writer.write(annotated)
        frame_count += 1

        if frame_count % 30 == 0:
            print(f"Processed {frame_count} frames")

finally:
    cap.release()
    writer.release()

print(f"Finished! Processed {frame_count} frames.")
print(f"Result saved to: {OUTPUT_PATH}")

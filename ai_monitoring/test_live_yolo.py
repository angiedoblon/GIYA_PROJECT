import cv2
from ultralytics import YOLO
import time

RTSP_URL = "rtsp://localhost:8554/tapo"
MODEL_PATH = "ai_monitoring/yolo26n.pt"

print("Loading YOLO model...")
model = YOLO(MODEL_PATH)

print("Connecting to Tapo C310...")
cap = cv2.VideoCapture(RTSP_URL)

if not cap.isOpened():
    print("ERROR: Could not open camera stream")
    exit()

print("Camera connected!")
print("Collecting frames for 10 seconds...")
print("Make sure a car is visible on the camera if possible.")

best_count = -1
best_frame = None
start_time = time.time()
frame_number = 0

while time.time() - start_time < 10:
    ret, frame = cap.read()

    if not ret:
        print("Failed to read frame")
        continue

    frame_number += 1

    results = model(
        frame,
        classes=[2, 3, 5, 7],
        conf=0.20,
        verbose=False
    )

    detections = results[0].boxes
    count = 0 if detections is None else len(detections)

    if count > best_count:
        best_count = count
        best_frame = results[0].plot()

    print(f"Frame {frame_number}: vehicles detected = {count}")

cap.release()

if best_frame is not None:
    output_file = "ai_monitoring/yolo_best_result.jpg"
    cv2.imwrite(output_file, best_frame)

    print()
    print("Finished!")
    print(f"Highest vehicle count: {best_count}")
    print(f"Best frame saved to: {output_file}")
else:
    print("No frames were captured.")
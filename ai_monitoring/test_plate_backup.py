import cv2
import easyocr
from ultralytics import YOLO

# ==========================================
# LOAD MODELS
# ==========================================

print("Loading license plate detector...")
model = YOLO("exp.pt")

print("Loading OCR...")
reader = easyocr.Reader(['en'])

print("===================================")
print("LICENSE PLATE DETECTOR + OCR READY")
print("===================================")

# ==========================================
# MEDIAMTX STREAM
# ==========================================

RTSP_URL = "rtsp://localhost:8554/tapo"

cap = cv2.VideoCapture(RTSP_URL)

if not cap.isOpened():
    print("ERROR: Could not connect to MediaMTX.")
    exit()

print("Camera connected.")
print("Press Q to quit.")

# ==========================================
# PROCESS CAMERA
# ==========================================

while True:

    success, frame = cap.read()

    if not success:
        print("WARNING: Could not read frame.")
        continue

    # YOLO license plate detection
    results = model.predict(
        source=frame,
        conf=0.25,
        verbose=False
    )

    # Process detections
    for result in results:

        if result.boxes is None:
            continue

        for box in result.boxes:

            # Get bounding box
            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0]
            )

            confidence = float(box.conf[0])

            # Make sure coordinates are inside image
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(frame.shape[1], x2)
            y2 = min(frame.shape[0], y2)

            # Crop license plate
            plate_crop = frame[y1:y2, x1:x2]

            if plate_crop.size == 0:
                continue

            # ==========================================
            # OCR
            # ==========================================

            ocr_results = reader.readtext(
                plate_crop
            )

            plate_text = ""

            for detection in ocr_results:

                text = detection[1]
                ocr_confidence = detection[2]

                if ocr_confidence > 0.20:
                    plate_text += text + " "

            plate_text = plate_text.strip()

            # ==========================================
            # DRAW DETECTION
            # ==========================================

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2
            )

            if plate_text:

                label = f"{plate_text} ({confidence:.2f})"

                print(
                    f"PLATE DETECTED: {plate_text} | "
                    f"YOLO CONF: {confidence:.2f}"
                )

                cv2.putText(
                    frame,
                    label,
                    (x1, max(30, y1 - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2
                )

            else:

                cv2.putText(
                    frame,
                    "Reading plate...",
                    (x1, max(30, y1 - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 255),
                    2
                )

    # Show camera
    cv2.imshow(
        "GIYA - License Plate Recognition",
        frame
    )

    # Quit
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

# ==========================================
# CLEANUP
# ==========================================

cap.release()
cv2.destroyAllWindows()

print("Camera stopped.")
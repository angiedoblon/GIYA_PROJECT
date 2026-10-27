import cv2
import easyocr
import re
import time
import threading
from collections import defaultdict, Counter
from ultralytics import YOLO

print("==============================================")
print(" GIYA VEHICLE + LICENSE PLATE RECOGNITION")
print("==============================================")

# Load Models
print("Loading vehicle model...")
vehicle_model = YOLO("yolo26n.pt")

print("Loading license plate model...")
plate_model = YOLO("ai_monitoring/exp.pt")

print("Loading OCR...")
reader = easyocr.Reader(["en"], gpu=False)

# RTSP Threaded Frame Grabber to Eliminate Streaming Lag
class RTSPStreamer:
    def __init__(self, src):
        self.cap = cv2.VideoCapture(src)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self.grabbed, self.frame = self.cap.read()
        self.started = False
        self.read_lock = threading.Lock()

    def start(self):
        if self.started:
            return self
        self.started = True
        self.thread = threading.Thread(target=self.update, args=())
        self.thread.daemon = True
        self.thread.start()
        return self

    def update(self):
        while self.started:
            grabbed, frame = self.cap.read()
            with self.read_lock:
                self.grabbed = grabbed
                self.frame = frame
            time.sleep(0.01)

    def read(self):
        with self.read_lock:
            return self.grabbed, self.frame.copy() if self.frame is not None else None

    def stop(self):
        self.started = False
        if self.thread.is_alive():
            self.thread.join()
        self.cap.release()

RTSP_URL = "rtsp://localhost:8554/tapo"
streamer = RTSPStreamer(RTSP_URL).start()
time.sleep(1.0)  # Warmup stream

vehicle_classes = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}

# Settings
PLATE_SCAN_INTERVAL = 3
MAX_HISTORY = 8
ALLOWLIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
MIN_PLATE_WIDTH = 20
MIN_PLATE_HEIGHT = 10

plate_history = defaultdict(list)
last_ocr_time = defaultdict(float)
frame_count = 0

def clean_plate_text(text):
    text = text.upper()
    text = re.sub(r"[^A-Z0-9]", "", text)
    if 4 <= len(text) <= 10:
        return text
    return ""

def read_plate_ocr(image):
    if image is None or image.size == 0:
        return ""

    best_text = ""
    best_confidence = 0.0

    try:
        # Pre-process Variants: Raw and Mild Gray Contrast
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply CLAHE instead of standard equalizeHist for localized contrast enhancement
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        contrast = clahe.apply(gray)

        variants = [image, gray, contrast]

        for img in variants:
            results = reader.readtext(
                img,
                allowlist=ALLOWLIST,
                detail=1,
                paragraph=False,
                min_size=10,
                text_threshold=0.3,
                low_text=0.2,
                mag_ratio=2.0
            )

            for result in results:
                raw_text = result[1]
                confidence = float(result[2])
                cleaned = clean_plate_text(raw_text)

                if cleaned and confidence > best_confidence:
                    best_text = cleaned
                    best_confidence = confidence

    except Exception as error:
        print("OCR WARNING:", error)

    if best_confidence >= 0.20:
        return best_text
    return ""

def save_plate(track_id, plate_text):
    if not plate_text:
        return ""
    if track_id is None:
        return plate_text

    plate_history[track_id].append(plate_text)
    if len(plate_history[track_id]) > MAX_HISTORY:
        plate_history[track_id] = plate_history[track_id][-MAX_HISTORY:]

    common = Counter(plate_history[track_id]).most_common(1)
    return common[0][0] if common else plate_text

def plate_belongs_to_vehicle(plate_box, vehicle_box):
    px1, py1, px2, py2 = plate_box
    vx1, vy1, vx2, vy2 = vehicle_box
    plate_center_x = (px1 + px2) / 2
    plate_center_y = (py1 + py2) / 2

    return (vx1 <= plate_center_x <= vx2) and (vy1 <= plate_center_y <= vy2)

# Main Loop
try:
    while True:
        success, frame = streamer.read()
        if not success or frame is None:
            time.sleep(0.01)
            continue

        frame_count += 1
        original_frame = frame.copy()
        h, w, _ = frame.shape

        # Vehicle Detection
        try:
            vehicle_results = vehicle_model.track(
                source=original_frame,
                persist=True,
                tracker="bytetrack.yaml",
                classes=list(vehicle_classes.keys()),
                conf=0.30,
                imgsz=416,
                max_det=10,
                verbose=False
            )
        except Exception as error:
            print("VEHICLE TRACKING WARNING:", error)
            continue

        vehicles = []
        for result in vehicle_results:
            if result.boxes is None or len(result.boxes) == 0:
                continue

            for box in result.boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                vehicle_name = vehicle_classes.get(class_id, "vehicle")
                track_id = int(box.id[0]) if box.id is not None else None

                x1, y1, x2, y2 = map(int, box.xyxy[0])
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)

                vehicle_box = (x1, y1, x2, y2)
                vehicles.append({
                    "box": vehicle_box,
                    "track_id": track_id,
                    "name": vehicle_name,
                    "confidence": confidence
                })

                cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
                cv2.putText(frame, f"{vehicle_name.upper()} ID:{track_id}", (x1, max(25, y1 - 8)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)

        # License Plate Detection
        if frame_count % PLATE_SCAN_INTERVAL == 0:
            try:
                plate_results = plate_model.predict(
                    source=original_frame,
                    conf=0.15,  # Raised slightly to avoid non-plate false positives
                    imgsz=640,  # Balanced resolution for plate detection speed
                    max_det=5,
                    verbose=False
                )

                for plate_result in plate_results:
                    if plate_result.boxes is None:
                        continue

                    for plate_box in plate_result.boxes:
                        plate_confidence = float(plate_box.conf[0])
                        px1, py1, px2, py2 = map(int, plate_box.xyxy[0])

                        # Add Padding around plate crop
                        pad_x = int((px2 - px1) * 0.08)
                        pad_y = int((py2 - py1) * 0.08)
                        
                        px1 = max(0, px1 - pad_x)
                        py1 = max(0, py1 - pad_y)
                        px2 = min(w, px2 + pad_x)
                        py2 = min(h, py2 + pad_y)

                        if (px2 - px1) < MIN_PLATE_WIDTH or (py2 - py1) < MIN_PLATE_HEIGHT:
                            continue

                        plate_box_coords = (px1, py1, px2, py2)
                        matched_vehicle = next((v for v in vehicles if plate_belongs_to_vehicle(plate_box_coords, v["box"])), None)

                        if matched_vehicle is None:
                            continue

                        track_id = matched_vehicle["track_id"]
                        current_time = time.time()

                        if track_id is not None and (current_time - last_ocr_time[track_id] < 0.8):
                            continue

                        if track_id is not None:
                            last_ocr_time[track_id] = current_time

                        plate_crop = original_frame[py1:py2, px1:px2]
                        plate_text = read_plate_ocr(plate_crop)

                        if plate_text:
                            stable_plate = save_plate(track_id, plate_text)
                            cv2.putText(frame, f"PLATE: {stable_plate}", (px1, max(25, py1 - 10)),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 0), 2)

                        cv2.rectangle(frame, (px1, py1), (px2, py2), (0, 255, 0), 2)

            except Exception as error:
                print("PLATE DETECTION WARNING:", error)

        cv2.imshow("GIYA Vehicle + License Plate", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

finally:
    streamer.stop()
    cv2.destroyAllWindows()
    print("\nGIYA monitoring stopped.")
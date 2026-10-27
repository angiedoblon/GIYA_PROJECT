import os
import re
import threading
import subprocess
import time
from ultralytics import YOLO
import easyocr

# Force low-latency RTSP capture via FFmpeg backend
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|fflags;nobuffer|flags;low_delay"

import cv2

MODEL_PATH = r"runs\detect\runs\detect\giya_license_plate_v2-2\weights\best.pt"
INPUT_STREAM_URL = "rtsp://127.0.0.1:8554/tapo"
OUTPUT_STREAM_URL = "rtsp://127.0.0.1:8554/processed"

class VideoStream:
    def __init__(self, src):
        self.stream = cv2.VideoCapture(src, cv2.CAP_FFMPEG)
        # Set buffer size to 1 to minimize lag
        self.stream.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self.grabbed, self.frame = self.stream.read()
        self.stopped = False
        self.lock = threading.Lock()

    def start(self):
        threading.Thread(target=self.update, daemon=True).start()
        return self

    def update(self):
        while not self.stopped:
            if not self.stream.isOpened():
                break
            grabbed, frame = self.stream.read()
            if grabbed:
                with self.lock:
                    self.grabbed = grabbed
                    self.frame = frame

    def read(self):
        with self.lock:
            return self.grabbed, self.frame.copy() if self.frame is not None else None

    def release(self):
        self.stopped = True
        self.stream.release()

print("Loading models...")
detector = YOLO(MODEL_PATH)
reader = easyocr.Reader(["en"], gpu=False)

camera = VideoStream(INPUT_STREAM_URL).start()
if not camera.stream.isOpened():
    print("ERROR: Cannot open camera stream.")
    raise SystemExit(1)

success, sample_frame = camera.read()
if not success or sample_frame is None:
    raise RuntimeError("Could not read initial frame from camera.")
h, w = sample_frame.shape[:2]
fps = 20

ffmpeg_cmd = [
    "ffmpeg", "-y",
    "-f", "rawvideo", "-vcodec", "rawvideo", "-pix_fmt", "bgr24",
    "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-tune", "zerolatency",
    "-f", "rtsp", OUTPUT_STREAM_URL
]

print(f"Streaming processed feed to: {OUTPUT_STREAM_URL}")
p = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE)

# Track OCR results per object ID to avoid running OCR every frame
# Format: { track_id: {"text": "ABC1234", "last_time": 0.0} }
ocr_cache = {}
CACHE_TTL = 3.0  # Re-run OCR on the same plate every 3 seconds

print("GIYA plate reader running in real-time mode. Press Ctrl+C to quit.")
last_printed_plate = ""

try:
    while True:
        success, frame = camera.read()
        if not success or frame is None:
            break

        # Use YOLO tracking instead of standard predict for tracking IDs
        results = detector.track(
            source=frame,
            conf=0.45,
            persist=True,
            tracker="botsort.yaml", # or "bytetrack.yaml"
            verbose=False
        )

        current_time = time.time()
        active_track_ids = set()

        for result in results:
            if result.boxes is None or result.boxes.id is None:
                continue
            
            boxes = result.boxes.xyxy.cpu().numpy()
            track_ids = result.boxes.id.cpu().numpy()

            for box, track_id in zip(boxes, track_ids):
                track_id = int(track_id)
                active_track_ids.add(track_id)
                x1, y1, x2, y2 = map(int, box)
                
                x1, x2 = max(0, x1), min(w, x2)
                y1, y2 = max(0, y1), min(h, y2)
                if x2 <= x1 or y2 <= y1:
                    continue

                # Check if we have a recent cached OCR result for this track ID
                cached_data = ocr_cache.get(track_id)
                if cached_data and (current_time - cached_data["last_time"] < CACHE_TTL):
                    plate_text = cached_data["text"]
                else:
                    # Run OCR only when cache expires
                    plate_crop = frame[y1:y2, x1:x2]
                    gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)
                    gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
                    gray = cv2.bilateralFilter(gray, 9, 17, 17)

                    ocr_results = reader.readtext(
                        gray, detail=1, allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                    )

                    plate_text = ""
                    if ocr_results:
                        plate_text = "".join(item[1] for item in ocr_results)
                        plate_text = re.sub(r"[^A-Z0-9]", "", plate_text.upper())

                    # Update cache
                    ocr_cache[track_id] = {"text": plate_text, "last_time": current_time}

                label = plate_text if plate_text else "Reading..."
                if plate_text and plate_text != last_printed_plate:
                    print(f"Plate [ID {track_id}]: {plate_text}")
                    last_printed_plate = plate_text

                # Draw UI
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(
                    frame, label, (x1, max(25, y1 - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2
                )

        # Cleanup old track IDs from cache
        for tid in list(ocr_cache.keys()):
            if tid not in active_track_ids:
                del ocr_cache[tid]

        try:
            p.stdin.write(frame.tobytes())
        except Exception:
            break

except KeyboardInterrupt:
    print("Stopping reader...")

finally:
    camera.release()
    p.stdin.close()
    p.wait()
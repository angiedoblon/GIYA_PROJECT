import os

# Request low-latency RTSP capture from OpenCV's FFmpeg backend.
# This must be set before opening the camera.
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
    "rtsp_transport;tcp|fflags;nobuffer|max_delay;0"
)

import cv2
import subprocess
import threading
import time
from ultralytics import YOLO


# =========================
# Configuration
# =========================

RTSP_INPUT = "rtsp://localhost:8554/tapo"
RTSP_OUTPUT = "rtsp://localhost:8554/tapo-yolo"

# Run this script from the ai_monitoring folder.
MODEL_PATH = "yolo26n.pt"

# COCO vehicle classes:
# bicycle=1, car=2, motorcycle=3, bus=5, truck=7
VEHICLE_CLASSES = [1, 2, 3, 5, 7]

CONFIDENCE = 0.20

# Smaller inference size can improve speed.
YOLO_IMAGE_SIZE = 416

FFMPEG = (
    r"C:\Users\Mark Jenesio Godes\AppData\Local\Microsoft\WinGet\Links"
    r"\ffmpeg.exe"
)


# =========================
# Load YOLO
# =========================

print("Loading YOLO model...")
model = YOLO(MODEL_PATH)

print("Connecting to Tapo C310...")

cap = cv2.VideoCapture(RTSP_INPUT, cv2.CAP_FFMPEG)

# Best effort: some OpenCV backends may ignore this setting.
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

if not cap.isOpened():
    raise RuntimeError(
        "Could not open the camera stream: " + RTSP_INPUT
    )

print("Camera connected!")

width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
fps = cap.get(cv2.CAP_PROP_FPS)

if width <= 0 or height <= 0:
    cap.release()
    raise RuntimeError("Could not determine camera resolution.")

if fps <= 0 or fps > 60:
    fps = 15.0

print(f"Input resolution: {width}x{height}")
print(f"Reported FPS: {fps:.2f}")


# =========================
# Latest-frame capture
# =========================

# The capture thread continuously reads frames.
# Old frames are replaced instead of building a queue.

latest_frame = None
frame_lock = threading.Lock()
stop_capture = threading.Event()
capture_error = None


def capture_frames():
    global latest_frame, capture_error

    while not stop_capture.is_set():
        ret, frame = cap.read()

        if not ret:
            capture_error = "Camera frame read failed."
            time.sleep(0.01)
            continue

        with frame_lock:
            latest_frame = frame


capture_thread = threading.Thread(
    target=capture_frames,
    daemon=True
)
capture_thread.start()

# Wait briefly for the first frame.
wait_start = time.time()

while time.time() - wait_start < 10:
    with frame_lock:
        if latest_frame is not None:
            break
    time.sleep(0.01)

with frame_lock:
    if latest_frame is None:
        stop_capture.set()
        cap.release()
        raise RuntimeError("No frames received from the camera.")


# =========================
# Start FFmpeg publisher
# =========================

ffmpeg_command = [
    FFMPEG,
    "-hide_banner",
    "-loglevel", "warning",

    # Raw frames supplied by Python
    "-f", "rawvideo",
    "-pixel_format", "bgr24",
    "-video_size", f"{width}x{height}",
    "-framerate", str(fps),
    "-i", "pipe:0",

    "-an",

    # Low-latency H.264 encoding
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-tune", "zerolatency",
    "-pix_fmt", "yuv420p",
    "-bf", "0",
    "-x264-params",
    "bframes=0:rc-lookahead=0:sync-lookahead=0",

    # Publish to MediaMTX
    "-flush_packets", "1",
    "-f", "rtsp",
    "-rtsp_transport", "tcp",
    RTSP_OUTPUT,
]

print("Starting FFmpeg publisher...")

try:
    ffmpeg = subprocess.Popen(
        ffmpeg_command,
        stdin=subprocess.PIPE
    )
except OSError as error:
    stop_capture.set()
    cap.release()
    raise RuntimeError(f"Could not start FFmpeg: {error}") from error


# =========================
# YOLO processing loop
# =========================

print()
print("========================================")
print("LOW-LATENCY YOLO STREAM STARTED")
print("========================================")
print(f"Input : {RTSP_INPUT}")
print(f"Output: {RTSP_OUTPUT}")
print("Press Ctrl+C to stop.")
print("========================================")

last_status_time = time.time()
processed_frames = 0
last_frame_id = None

try:
    while True:
        if ffmpeg.poll() is not None:
            raise RuntimeError(
                "FFmpeg exited. Check the MediaMTX logs above."
            )

        # Take the newest frame, not a backlog of old frames.
        with frame_lock:
            frame = (
                latest_frame.copy()
                if latest_frame is not None
                else None
            )

        if frame is None:
            time.sleep(0.005)
            continue

        # Detect vehicles at a smaller image size for speed.
        results = model(
            frame,
            classes=VEHICLE_CLASSES,
            conf=CONFIDENCE,
            imgsz=YOLO_IMAGE_SIZE,
            verbose=False
        )

        annotated_frame = results[0].plot()

        # Publish annotated frames.
        try:
            ffmpeg.stdin.write(annotated_frame.tobytes())
        except (BrokenPipeError, OSError):
            raise RuntimeError(
                "FFmpeg closed the video input pipe."
            )

        processed_frames += 1

        # Print a status once per second instead of spamming
        # the terminal with every detection.
        now = time.time()

        if now - last_status_time >= 1.0:
            elapsed = now - last_status_time
            processing_fps = processed_frames / elapsed

            print(
                f"YOLO output speed: {processing_fps:.1f} FPS"
            )

            boxes = results[0].boxes

            if boxes is not None:
                for box in boxes:
                    class_id = int(box.cls[0])
                    confidence = float(box.conf[0])
                    name = results[0].names[class_id]

                    print(
                        f"Vehicle: {name} | "
                        f"Confidence: {confidence:.2f}"
                    )

            processed_frames = 0
            last_status_time = now

except KeyboardInterrupt:
    print("\nStopping YOLO stream...")

finally:
    stop_capture.set()
    capture_thread.join(timeout=2)
    cap.release()

    if ffmpeg.stdin and not ffmpeg.stdin.closed:
        try:
            ffmpeg.stdin.close()
        except OSError:
            pass

    try:
        ffmpeg.wait(timeout=3)
    except subprocess.TimeoutExpired:
        ffmpeg.terminate()

        try:
            ffmpeg.wait(timeout=2)
        except subprocess.TimeoutExpired:
            ffmpeg.kill()
            ffmpeg.wait()

    print("YOLO stream stopped.")
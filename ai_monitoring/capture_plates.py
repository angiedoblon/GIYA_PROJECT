
import os
import time
import cv2

# Your existing Tapo camera stream
RTSP_URL = "rtsp://127.0.0.1:8554/tapo"

# New folder for collected images
SAVE_DIR = "license_plate_collection"

os.makedirs(SAVE_DIR, exist_ok=True)

# Use TCP for the RTSP connection
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"

print("Connecting to Tapo camera...")

cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

if not cap.isOpened():
    print("ERROR: Cannot open camera stream.")
    print("Check that MediaMTX and the Tapo stream are running.")
    raise SystemExit(1)

print("\nCamera connected!")
print("S = Save current frame")
print("Q = Quit")
print("Collect different views of license plates.\n")

image_count = len([
    f for f in os.listdir(SAVE_DIR)
    if f.lower().endswith((".jpg", ".jpeg", ".png"))
])

try:
    while True:
        ret, frame = cap.read()

        if not ret or frame is None:
            print("Camera frame unavailable. Retrying...")
            time.sleep(0.2)
            continue

        display = frame.copy()

        cv2.putText(
            display,
            f"Saved images: {image_count}",
            (20, 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 0),
            2
        )

        cv2.putText(
            display,
            "Press S to save | Q to quit",
            (20, 70),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2
        )

        cv2.imshow("GIYA - Plate Image Collection", display)

        key = cv2.waitKey(1) & 0xFF

        if key == ord("s"):
            filename = os.path.join(
                SAVE_DIR,
                f"plate_{int(time.time() * 1000)}.jpg"
            )

            if cv2.imwrite(filename, frame):
                image_count += 1
                print(f"Saved image {image_count}: {filename}")
            else:
                print("Could not save image.")

            # Prevent accidental repeated saves.
            time.sleep(0.3)

        elif key == ord("q"):
            break

finally:
    cap.release()
    cv2.destroyAllWindows()
    print(f"\nFinished! Total images: {image_count}")
    print(f"Images saved in: {os.path.abspath(SAVE_DIR)}")
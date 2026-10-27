
import cv2

url = "rtsp://127.0.0.1:8554/tapo"

camera = cv2.VideoCapture(url)

if not camera.isOpened():
    print("ERROR: Cannot open camera stream.")
    raise SystemExit(1)

print("Camera opened. Press Q to quit.")

while True:
    success, frame = camera.read()

    if not success:
        print("Failed to read camera frame.")
        break

    cv2.imshow("Camera Only - No AI", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

camera.release()
cv2.destroyAllWindows()

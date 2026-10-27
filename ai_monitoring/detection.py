from ultralytics import YOLO

# Load YOLO model
model = YOLO("yolo26n.pt")

# MediaMTX RTSP stream
RTSP_URL = "rtsp://localhost:8554/tapo"

# Vehicle classes from COCO
vehicle_classes = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck"
}

print("Starting vehicle detection...")
print("Connecting to camera...")
print("Place a vehicle in front of the camera.")

results = model.track(
    source=RTSP_URL,
    stream=True,
    persist=True,
    classes=list(vehicle_classes.keys()),
    show=False,
    tracker="bytetrack.yaml",
    conf=0.25
)

for result in results:

    if result.boxes is not None and len(result.boxes) > 0:

        for box in result.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])

            vehicle_name = vehicle_classes.get(
                class_id,
                result.names[class_id]
            )

            track_id = (
                int(box.id[0])
                if box.id is not None
                else None
            )

            print(
                f"VEHICLE: {vehicle_name.upper()} | "
                f"CONFIDENCE: {confidence:.2f} | "
                f"TRACK ID: {track_id}"
            )
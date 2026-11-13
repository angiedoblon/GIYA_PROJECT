from pathlib import Path
import json
import os
import cv2
import numpy as np
from ultralytics import YOLO

BASE_DIR = Path(__file__).resolve().parent
VIDEO_PATH = BASE_DIR / "parking_test.mp4"
MODEL_PATH = BASE_DIR / "yolo26n.pt"
SLOTS_PATH = BASE_DIR / "parking_slots.json"
OUTPUT_PATH = BASE_DIR / "parking_occupancy_result.mp4"

VEHICLE_CLASSES = [2, 3, 5, 7]  # car, motorcycle, bus, truck
CONFIDENCE = 0.20
IMAGE_SIZE = 416


def save_slots(slots, width, height):
    data = {
        "video": VIDEO_PATH.name,
        "width": int(width),
        "height": int(height),
        "slots": [[[int(x), int(y)] for x, y in polygon] for polygon in slots],
    }
    temp_path = SLOTS_PATH.with_suffix(".tmp")
    try:
        temp_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        os.replace(temp_path, SLOTS_PATH)
        print(f"Saved {len(slots)} slots to: {SLOTS_PATH}")
    except OSError as exc:
        print(f"ERROR: Could not save parking slots: {exc}")
        try:
            if temp_path.exists():
                temp_path.unlink()
        except OSError:
            pass
        raise


def load_slots(width, height):
    if not SLOTS_PATH.exists():
        print("No saved parking slots found; you will need to mark them once.")
        return None
    try:
        data = json.loads(SLOTS_PATH.read_text(encoding="utf-8"))
        if data.get("video") != VIDEO_PATH.name:
            print("Saved slots belong to a different video; mark slots again.")
            return None
        if data.get("width") != width or data.get("height") != height:
            print("Video dimensions changed; saved slots cannot be reused.")
            return None
        raw_slots = data.get("slots")
        if not isinstance(raw_slots, list) or not raw_slots:
            print("Saved slot file has no slots; mark slots again.")
            return None
        valid_slots = []
        for polygon in raw_slots:
            if not isinstance(polygon, list) or len(polygon) != 4:
                print("Saved slot file contains an invalid polygon.")
                return None
            points = []
            for point in polygon:
                if not isinstance(point, list) or len(point) != 2:
                    print("Saved slot file contains an invalid point.")
                    return None
                x, y = point
                if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
                    print("Saved slot file contains non-numeric coordinates.")
                    return None
                if not (0 <= x < width and 0 <= y < height):
                    print("Saved slot coordinate is outside the video frame.")
                    return None
                points.append((int(x), int(y)))
            valid_slots.append(points)
        print(f"Loaded {len(valid_slots)} saved parking slots.")
        return valid_slots
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print(f"Could not read saved slots: {exc}")
        return None


def mark_slots(first_frame, width, height):
    slots = load_slots(width, height)
    if slots is not None:
        choice = input("Reuse saved slots? Enter Y to reuse, N to mark again: ").strip().lower()
        if choice == "y":
            return slots
        if choice != "n":
            print("Unrecognized choice; reusing saved slots.")
            return slots

    slots = []
    current_points = []

    def mouse_callback(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            current_points.append((int(x), int(y)))
            print(f"Corner {len(current_points)}/4: ({x}, {y})")

    window_name = "Mark Parking Slots"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.setMouseCallback(window_name, mouse_callback)
    print(
        "\nMARK PARKING SLOTS\n"
        "- Click 4 corners around one parking space, in perimeter order.\n"
        "- Press N to save each completed slot.\n"
        "- Press U to undo a corner in the current slot.\n"
        "- Press S to save and finish marking.\n"
        "- Press Q or Esc to save completed slots and quit.\n"
        "- Confirm 'Saved X slots' appears in PowerShell after each N.\n"
    )
    try:
        while True:
            display = first_frame.copy()
            for i, polygon in enumerate(slots):
                pts = np.array(polygon, dtype=np.int32)
                cv2.polylines(display, [pts], True, (0, 255, 0), 2)
                cv2.putText(display, f"Slot {i + 1}", tuple(map(int, polygon[0])),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            for point in current_points:
                cv2.circle(display, point, 5, (0, 255, 255), -1)
            if len(current_points) > 1:
                cv2.polylines(display, [np.array(current_points, dtype=np.int32)],
                              False, (0, 255, 255), 2)
            cv2.putText(display,
                        f"Saved slots: {len(slots)} | Current corners: {len(current_points)}/4",
                        (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
            cv2.imshow(window_name, display)
            key = cv2.waitKey(20) & 0xFF

            if key == ord("n"):
                if len(current_points) == 4:
                    slots.append(current_points.copy())
                    current_points.clear()
                    save_slots(slots, width, height)
                else:
                    print(f"You have {len(current_points)} corners. Click exactly 4 before N.")
            elif key == ord("u"):
                if current_points:
                    current_points.pop()
                    print(f"Removed a corner. Current count: {len(current_points)}")
                elif slots:
                    slots.pop()
                    print(f"Removed the last saved slot. Remaining: {len(slots)}")
                    if slots:
                        save_slots(slots, width, height)
                    elif SLOTS_PATH.exists():
                        SLOTS_PATH.unlink()
                        print("No saved slots remain; removed the empty slot file.")
            elif key == ord("s"):
                if current_points:
                    if len(current_points) == 4:
                        slots.append(current_points.copy())
                        current_points.clear()
                    else:
                        print("Finish the current slot with 4 corners, or press U to undo.")
                        continue
                if slots:
                    save_slots(slots, width, height)
                    print(f"Finished marking {len(slots)} slots.")
                    return slots
                print("Mark at least one complete slot first.")
            elif key in (ord("q"), 27):
                if slots:
                    save_slots(slots, width, height)
                    print("Completed slots saved. Quit requested; video will not be processed.")
                else:
                    print("No completed slots to save.")
                raise SystemExit("Stopped during parking-slot marking.")
    finally:
        cv2.destroyAllWindows()


def main():
    if not VIDEO_PATH.exists():
        raise FileNotFoundError(f"Missing video: {VIDEO_PATH}")
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Missing YOLO model: {MODEL_PATH}")

    cap = cv2.VideoCapture(str(VIDEO_PATH))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {VIDEO_PATH}")
    writer = None
    try:
        ret, first_frame = cap.read()
        if not ret:
            raise RuntimeError("Cannot read the first frame of parking_test.mp4.")
        height, width = first_frame.shape[:2]
        slots = mark_slots(first_frame, width, height)

        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        fps = cap.get(cv2.CAP_PROP_FPS)
        if not np.isfinite(fps) or fps <= 0:
            fps = 15.0
        writer = cv2.VideoWriter(str(OUTPUT_PATH), cv2.VideoWriter_fourcc(*"mp4v"),
                                 fps, (width, height))
        if not writer.isOpened():
            raise RuntimeError(f"Could not create output video: {OUTPUT_PATH}")

        model = YOLO(str(MODEL_PATH))
        frame_count = 0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        print("\nProcessing video. Press Q in the preview window to stop early.")
        preview_name = "Parking Occupancy Result"
        cv2.namedWindow(preview_name, cv2.WINDOW_NORMAL)

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            result = model.predict(frame, classes=VEHICLE_CLASSES, conf=CONFIDENCE,
                                   imgsz=IMAGE_SIZE, verbose=False)[0]
            vehicle_centers = []
            if result.boxes is not None:
                for box in result.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                    vehicle_centers.append(((x1 + x2) // 2, (y1 + y2) // 2))

            occupied_count = 0
            for i, polygon in enumerate(slots):
                pts = np.array(polygon, dtype=np.int32)
                occupied = any(cv2.pointPolygonTest(pts.astype(np.float32), center, False) >= 0
                               for center in vehicle_centers)
                if occupied:
                    occupied_count += 1
                    color, status = (0, 0, 255), "OCCUPIED"
                else:
                    color, status = (0, 255, 0), "FREE"
                overlay = frame.copy()
                cv2.fillPoly(overlay, [pts], color)
                frame = cv2.addWeighted(overlay, 0.18, frame, 0.82, 0)
                cv2.polylines(frame, [pts], True, color, 2)
                cv2.putText(frame, f"{i + 1}: {status}", tuple(map(int, polygon[0])),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

            free_count = len(slots) - occupied_count
            cv2.rectangle(frame, (10, 10), (385, 110), (25, 25, 25), -1)
            cv2.putText(frame, f"TOTAL SLOTS: {len(slots)}", (20, 35),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
            cv2.putText(frame, f"OCCUPIED: {occupied_count}", (20, 62),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 255), 2)
            cv2.putText(frame, f"FREE: {free_count}", (20, 89),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 0), 2)
            writer.write(frame)
            cv2.imshow(preview_name, frame)
            frame_count += 1
            if frame_count % 30 == 0:
                print(f"Processed {frame_count}/{total_frames or '?'} frames")
            if cv2.waitKey(1) & 0xFF == ord("q"):
                print("Preview quit requested; stopping processing early.")
                break

        print(f"\nFinished processing {frame_count} frames.")
        print(f"Result video: {OUTPUT_PATH}")
        print(f"Saved parking slots: {SLOTS_PATH}")
    finally:
        if writer is not None:
            writer.release()
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

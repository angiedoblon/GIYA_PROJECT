
import json
import shutil
from pathlib import Path

# Project paths
ROOT = Path(__file__).resolve().parent
NDJSON = ROOT / "license_plate_dataset_export" / "downloaded Ultralytics dataset" / "kind-stallion.ndjson"
SOURCE_IMAGES = ROOT / "license_plate_dataset" / "images" / "train"
OUTPUT = ROOT / "license_plate_yolo"

# Create YOLO folders
for folder in [
    OUTPUT / "images" / "train",
    OUTPUT / "images" / "val",
    OUTPUT / "labels" / "train",
    OUTPUT / "labels" / "val",
]:
    folder.mkdir(parents=True, exist_ok=True)

# Read the dataset metadata and image annotations
image_records = []
with NDJSON.open("r", encoding="utf-8") as f:
    for line in f:
        if line.strip():
            record = json.loads(line)
            if record.get("type") == "image":
                image_records.append(record)

# Use only images that have at least one bounding box
annotated = [
    record for record in image_records
    if record.get("annotations", {}).get("boxes")
]

if len(annotated) < 2:
    raise RuntimeError("Not enough annotated images found in the NDJSON file.")

# Preserve the dataset's train/validation split when provided.
# If there is no validation split, reserve approximately 20%.
train_records = [r for r in annotated if r.get("split") == "train"]
val_records = [r for r in annotated if r.get("split") in ("val", "valid", "validation")]

if not val_records:
    train_records = [r for r in annotated if r.get("split") != "train"]
    if not train_records:
        train_records = annotated[:]
    val_records = train_records[::5]
    train_records = [r for r in train_records if r not in val_records]

if not train_records or not val_records:
    # Fallback for a very small dataset
    train_records = annotated[:-1]
    val_records = annotated[-1:]

def find_image(filename):
    # Match images by filename in the existing capture folder
    matches = list(SOURCE_IMAGES.rglob(filename))
    return matches[0] if matches else None

copied = 0
missing = []

for split, records in (("train", train_records), ("val", val_records)):
    for record in records:
        filename = Path(record["file"]).name
        source = find_image(filename)

        if source is None:
            missing.append(filename)
            continue

        shutil.copy2(source, OUTPUT / "images" / split / filename)

        width = float(record["width"])
        height = float(record["height"])
        label_lines = []

        for box in record.get("annotations", {}).get("boxes", []):
            # NDJSON box format: [class_id, x_center, y_center, width, height]
            # Coordinates are normalized, so YOLO uses them directly.
            class_id, x_center, y_center, box_width, box_height = box
            label_lines.append(
                f"{int(class_id)} {float(x_center):.6f} "
                f"{float(y_center):.6f} {float(box_width):.6f} "
                f"{float(box_height):.6f}"
            )

        label_path = OUTPUT / "labels" / split / f"{Path(filename).stem}.txt"
        label_path.write_text("\n".join(label_lines) + "\n", encoding="utf-8")
        copied += 1

# Create the YOLO configuration
yaml_text = (
    f"path: {OUTPUT.as_posix()}\n"
    "train: images/train\n"
    "val: images/val\n\n"
    "names:\n"
    "  0: license_plate\n"
)
(OUTPUT / "data.yaml").write_text(yaml_text, encoding="utf-8")

print(f"Annotated records in NDJSON: {len(annotated)}")
print(f"Images copied and labeled: {copied}")
print(f"Training images: {len(list((OUTPUT / 'images' / 'train').glob('*')))}")
print(f"Validation images: {len(list((OUTPUT / 'images' / 'val').glob('*')))}")
print(f"Dataset configuration: {OUTPUT / 'data.yaml'}")

if missing:
    print("\nImages not matched by filename:")
    for filename in sorted(set(missing)):
        print(" -", filename)
    print("\nSome captured images may have different names from the exported dataset.")
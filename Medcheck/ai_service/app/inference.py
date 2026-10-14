
from pathlib import Path
from ultralytics import YOLO

# Locate the trained model
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "best.pt"

# Load the model once
model = YOLO(str(MODEL_PATH))


def analyze_image(image_path, confidence_threshold=0.25):
    """Detect intact and broken blister cavities."""

    image_path = Path(image_path)

    if not image_path.is_file():
        raise FileNotFoundError(f"Image not found: {image_path}")

    output_dir = BASE_DIR / "annotated_images"
    output_dir.mkdir(parents=True, exist_ok=True)

    results = model.predict(
        source=str(image_path),
        conf=confidence_threshold,
        save=True,
        project=str(output_dir),
        name="predict",
        exist_ok=True,
        verbose=False
    )

    result = results[0]

    actual_image_path = (
        Path(result.save_dir) / f"{image_path.stem}.jpg"
    )

    print("ACTUAL SAVED IMAGE:", actual_image_path)
    print("IMAGE EXISTS:", actual_image_path.exists())

    detections = []
    counts = {
        "intact": 0,
        "broken": 0
    }

    if result.boxes is not None:
        for box in result.boxes:
            class_id = int(box.cls[0].item())
            class_name = model.names[class_id]
            confidence = float(box.conf[0].item())

            x1, y1, x2, y2 = box.xyxy[0].tolist()

            counts[class_name] = counts.get(class_name, 0) + 1

            detections.append({
                "class_id": class_id,
                "class_name": class_name,
                "confidence": round(confidence, 4),
                "bbox": [
                    round(x1, 2),
                    round(y1, 2),
                    round(x2, 2),
                    round(y2, 2)
                ]
            })

    return {
        "image_name": image_path.name,
        "annotated_image": (
            f"/annotated-images/predict/{image_path.stem}.jpg"
        ),
        "total_detections": len(detections),
        "counts": counts,
        "detections": detections
    }

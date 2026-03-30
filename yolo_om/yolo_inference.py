from ultralytics import YOLO

model = YOLO("/home/mansi/Desktop/mini_project/yolo_om/blister_detection_best.pt")  # your trained model

def run_yolo(image_path):
    results = model(image_path)

    detections = []

    for r in results:
        boxes = r.boxes

        for box in boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])

            label = model.names[cls_id]

            detections.append({
                "label": label,          # "intact" or "broken"
                "confidence": conf,
                "bbox": box.xyxy[0]      # optional (for cavity mapping later)
            })

    return detections
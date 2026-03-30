from yolo_inference import run_yolo
from mapping import map_yolo_output
from decision_test import second_scan

def run(pack_id, image_path):
    detections = run_yolo(image_path)

    yolo_output = map_yolo_output(detections)

    second_scan(pack_id, yolo_output, trigger="motion")

if __name__ == "__main__":
    pack_id = input("Enter pack_id: ")
    image_path = input("Enter image path: ")

    run(pack_id, image_path)
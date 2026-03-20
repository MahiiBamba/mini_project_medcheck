import cv2
import numpy as np
import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

print("Loading model...")
model = tf.keras.models.load_model("medcheck_mobilenet_v2.h5", compile=False)
print("Model loaded successfully")

IMG_SIZE = 224


def preprocess(img):
    img = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
    img = preprocess_input(img)
    img = np.expand_dims(img, axis=0)
    return img


cap = cv2.VideoCapture(1)

# Improve camera resolution
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

print("Press 'q' to quit")

while True:

    ret, frame = cap.read()
    if not ret:
        break

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (9, 9), 2)

    circles = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=90,
        param1=100,
        param2=40,
        minRadius=35,
        maxRadius=70
    )

    if circles is not None:

        circles = np.round(circles[0, :]).astype("int")

        # Remove duplicate circles
        filtered_circles = []

        for (x, y, r) in circles:

            duplicate = False
            for (fx, fy, fr) in filtered_circles:
                dist = np.sqrt((x - fx)**2 + (y - fy)**2)
                if dist < 50:
                    duplicate = True
                    break

            if not duplicate:
                filtered_circles.append((x, y, r))

        for (x, y, r) in filtered_circles:

            # Ignore abnormal circles
            if r < 35 or r > 70:
                continue

            crop_scale = 0.6
            r2 = int(r * crop_scale)

            x1 = max(0, x - r2)
            y1 = max(0, y - r2)
            x2 = min(frame.shape[1], x + r2)
            y2 = min(frame.shape[0], y + r2)

            cavity = frame[y1:y2, x1:x2]

            if cavity.size == 0:
                continue

            img = preprocess(cavity)

            pred = model.predict(img, verbose=0)[0][0]

            # Slightly stricter threshold
            threshold = 0.70

            if pred > threshold:
                label = "INTACT"
                conf = pred
                color = (0,255,0)
            else:
                label = "BROKEN"
                conf = 1-pred
                color = (0,0,255)

            cv2.circle(frame, (x, y), r, color, 3)

            cv2.putText(
                frame,
                f"{label} {conf:.2f}",
                (x - 40, y - r - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                color,
                2
            )

    cv2.imshow("Blister Monitor", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
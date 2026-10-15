import cv2
import numpy as np
import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

print("Loading model...")
model = tf.keras.models.load_model("medcheck_mobilenet_v2.h5", compile=False)
print("Model loaded")

IMG_SIZE = 224

def preprocess(img):
    img = cv2.resize(img,(IMG_SIZE,IMG_SIZE))
    img = preprocess_input(img)
    img = np.expand_dims(img,axis=0)
    return img


cap = cv2.VideoCapture("blister_test_1.mp4")

rows = 3
cols = 5

print("Press q to quit")

while True:

    ret, frame = cap.read()

    if not ret:
        break

    frame = cv2.resize(frame,(1280,720))

    # --------------------------------
    # Detect blister pack
    # --------------------------------

    gray = cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray,(5,5),0)

    _, thresh = cv2.threshold(blur,120,255,cv2.THRESH_BINARY_INV)

    contours,_ = cv2.findContours(
        thresh,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    if len(contours) == 0:
        cv2.imshow("Blister Monitor",frame)
        continue

    # largest contour = blister pack
    c = max(contours,key=cv2.contourArea)

    x,y,w,h = cv2.boundingRect(c)

    pack = frame[y:y+h,x:x+w]

    cv2.rectangle(frame,(x,y),(x+w,y+h),(255,0,0),2)

    # --------------------------------
    # Grid inside pack
    # --------------------------------

    ph, pw, _ = pack.shape

    cell_h = ph // rows
    cell_w = pw // cols

    for r in range(rows):
        for c in range(cols):

            y1 = y + r*cell_h
            y2 = y + (r+1)*cell_h

            x1 = x + c*cell_w
            x2 = x + (c+1)*cell_w

            cavity = frame[y1:y2,x1:x2]

            img = preprocess(cavity)

            pred = model.predict(img,verbose=0)[0][0]

            if pred > 0.7:
                label = "INTACT"
                color = (0,255,0)
                conf = pred
            else:
                label = "BROKEN"
                color = (0,0,255)
                conf = 1-pred

            cv2.rectangle(frame,(x1,y1),(x2,y2),color,2)

            cv2.putText(
                frame,
                f"{label} {conf:.2f}",
                (x1+5,y1+20),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                color,
                2
            )

    cv2.imshow("Blister Monitor",frame)

    if cv2.waitKey(30) & 0xFF == ord('q'):
        break


cap.release()
cv2.destroyAllWindows()
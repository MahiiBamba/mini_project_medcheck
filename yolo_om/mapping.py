def map_yolo_output(detections):
    """
    Convert YOLO labels → system states
    """

    output = {}

    for idx, d in enumerate(detections, start=1):

        label = d["label"]
        conf = d["confidence"]

        if label == "intact":
            state = "intact"
        elif label == "broken":
            state = "empty"
        else:
            state = "unknown"

        # temporary cavity_id assignment (sequential)
        cavity_id = idx

        output[cavity_id] = (state, conf)

    return output
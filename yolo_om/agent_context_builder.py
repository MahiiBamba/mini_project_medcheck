def build_context(events):
    summary = []

    for e in events:
        summary.append({
            "cavity_id": e["cavity_id"],
            "state": e["state"],
            "decision": e["decision_type"],
            "severity": e["severity"],
            "time": e["decided_at"]
        })

    memory = {
        "status": "sufficient" if len(summary) >= 5 else "sparse",
        "total_events": len(summary),
        "history": summary
    }

    yolo_output = {}  # placeholder (if you add YOLO later in pipeline)

    return {
        "memory": memory,
        "yolo_output": yolo_output
    }
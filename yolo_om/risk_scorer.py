def get_severity_weight(severity):
    mapping = {
        "low": 1,
        "medium": 2,
        "high": 3,
        "critical": 4
    }
    return mapping.get(severity, 1)


def compute_risk_score(memory, yolo_output):
    history = memory.get("history", [])
    total_events = memory.get("total_events", 0)

    if total_events == 0:
        return 0

    # --- 1. Severity Score (normalized 0–1) ---
    severity_total = 0
    for event in history:
        severity_total += get_severity_weight(event.get("severity"))

    max_possible_severity = 4 * total_events
    severity_score = severity_total / max_possible_severity

    # --- 2. Frequency Score (normalized 0–1) ---
    double_dose_count = sum(
        1 for e in history if e.get("decision") == "double_dose"
    )

    dose_late_count = sum(
        1 for e in history if e.get("decision") == "dose_late"
    )

    frequency_score = (double_dose_count + dose_late_count) / total_events

    # --- 3. Pattern Penalty (bounded) ---
    pattern_penalty = 0

    if double_dose_count > 2:
        pattern_penalty += 0.5

    if dose_late_count > 3:
        pattern_penalty += 0.5

    # --- 4. Weighted Score (0–1 range) ---
    risk_score = (
        0.5 * severity_score +
        0.3 * frequency_score +
        0.2 * pattern_penalty
    )

    # --- 5. Scale to 0–10 and clamp ---
    risk_score = risk_score * 10
    risk_score = max(0, min(10, risk_score))

    return round(risk_score, 2)
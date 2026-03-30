def generate_alerts(memory, risk_score):
    alerts = []

    history = memory.get("history", [])

    # --- Threshold-based alerts ---
    if risk_score >= 7:
        alerts.append({
            "type": "high_risk",
            "message": "High overall risk detected. Immediate attention required."
        })

    elif risk_score >= 5:
        alerts.append({
            "type": "medium_risk",
            "message": "Moderate risk detected. Monitor closely."
        })

    # --- Behavioral alerts ---
    double_dose_count = sum(
        1 for e in history if e.get("decision") == "double_dose"
    )

    dose_late_count = sum(
        1 for e in history if e.get("decision") == "dose_late"
    )

    if double_dose_count >= 3:
        alerts.append({
            "type": "double_dose_pattern",
            "message": "Repeated double dose behavior detected."
        })

    if dose_late_count >= 4:
        alerts.append({
            "type": "dose_delay_pattern",
            "message": "Frequent delayed dosing detected."
        })

    return alerts
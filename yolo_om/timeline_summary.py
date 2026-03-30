from collections import defaultdict

def build_timeline_summary(memory):
    history = memory.get("history", [])

    if not history:
        return "No historical data available."

    # Group by date (optional simplification)
    timeline = defaultdict(list)

    for event in history:
        timestamp = event.get("timestamp")
        decision = event.get("decision")
        cavity = event.get("cavity_id")

        timeline[timestamp].append({
            "cavity_id": cavity,
            "decision": decision
        })

    # Build summary string
    summary_lines = []

    for ts in sorted(timeline.keys(), reverse=True):
        events = timeline[ts]
        summary_lines.append(f"{ts}:")
        for e in events:
            summary_lines.append(
                f"  - cavity {e['cavity_id']} → {e['decision']}"
            )

    return "\n".join(summary_lines)

import sqlite3

DB_PATH = "medcheck.db"


def get_timeline_summary(pack_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    query = """
    SELECT 
        cs.captured_at,
        cs.cavity_id,
        cs.state,
        de.decision_type
    FROM cavity_snapshots cs
    JOIN scan_sessions ss ON cs.session_id = ss.session_id
    LEFT JOIN decision_events de ON cs.snapshot_id = de.snapshot_id
    WHERE ss.pack_id = ?
    ORDER BY cs.captured_at ASC
    """

    cursor.execute(query, (pack_id,))
    rows = cursor.fetchall()

    conn.close()

    if not rows:
        return "No timeline data available."

    summary_lines = []

    for row in rows:
        captured_at, cavity_id, state, decision = row
        summary_lines.append(
            f"{captured_at}: cavity {cavity_id} → {state} ({decision})"
        )

    return "\n".join(summary_lines)
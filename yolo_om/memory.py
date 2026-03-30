import sqlite3
from datetime import datetime, timedelta

DB_PATH = "medcheck.db"  # update if needed


def get_connection():
    return sqlite3.connect(DB_PATH)


def fetch_last_n_days_data(pack_id, days=7):
    conn = get_connection()
    cursor = conn.cursor()

    cutoff_date = datetime.now() - timedelta(days=days)

    cursor.execute("""
        SELECT cavity_id, state, decision, severity, timestamp
        FROM scan_sessions
        WHERE pack_id = ?
        AND timestamp >= ?
        ORDER BY timestamp DESC
    """, (pack_id, cutoff_date))

    rows = cursor.fetchall()
    conn.close()

    return rows

def build_memory_context(pack_id):
    data = fetch_last_n_days_data(pack_id)

    total_events = len(data)

    if total_events == 0:
        return {
            "status": "cold_start",
            "days_of_data": 0,
            "total_events": 0,
            "history": []
        }

    # Convert rows into structured format
    history = []
    for row in data:
        history.append({
            "cavity_id": row[0],
            "state": row[1],
            "decision": row[2],
            "severity": row[3],
            "timestamp": row[4]
        })

    days_of_data = 7  # since we queried last 7 days

    if total_events < 5:
        status = "sparse"
    else:
        status = "sufficient"

    return {
        "status": status,
        "days_of_data": days_of_data,
        "total_events": total_events,
        "history": history
    }
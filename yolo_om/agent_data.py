import sqlite3

DB_PATH = "medcheck.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def fetch_recent_events(pack_id, limit=50):
    conn = get_connection()

    rows = conn.execute("""
        SELECT de.*, cs.cavity_id, cs.state, ss.scanned_at
        FROM decision_events de
        JOIN cavity_snapshots cs ON de.snapshot_id = cs.snapshot_id
        JOIN scan_sessions ss ON cs.session_id = ss.session_id
        WHERE ss.pack_id = ?
        ORDER BY de.decided_at DESC
        LIMIT ?
    """, (pack_id, limit)).fetchall()

    conn.close()

    return [dict(row) for row in rows]
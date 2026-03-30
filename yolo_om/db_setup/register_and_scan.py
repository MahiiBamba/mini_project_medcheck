import sqlite3
import uuid

from datetime import datetime

def get_local_time():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

DB_PATH = "medcheck.db"

# ── DB CONNECTION ─────────────────────────────────────────────

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ── REGISTER PACK ─────────────────────────────────────────────

def register_pack(conn, pack_id, total_cavities):
    conn.execute("""
        INSERT INTO packs (pack_id, total_cavities)
        VALUES (?, ?)
    """, (pack_id, total_cavities))
    conn.commit()

# ── ADD SCHEDULE ─────────────────────────────────────────────

def add_schedule(conn, pack_id):
    schedule = [
        (1, "08:00", "Morning"),
        (2, "08:00", "Morning"),
        (3, "20:00", "Evening"),
        (4, "20:00", "Evening"),
    ]

    for cavity_id, time, label in schedule:
        conn.execute("""
            INSERT INTO dose_schedule (pack_id, cavity_id, expected_time, day_label)
            VALUES (?, ?, ?, ?)
        """, (pack_id, cavity_id, time, label))

    conn.commit()

# ── YOLO SIMULATION (replace later) ───────────────────────────

def run_yolo():
    # Simulated baseline (all intact)
    return {
        1: ("intact", 0.95),
        2: ("intact", 0.93),
        3: ("intact", 0.91),
        4: ("intact", 0.90),
    }

# ── BASELINE SCAN ────────────────────────────────────────────

def baseline_scan(conn, pack_id, yolo_output):
    cursor = conn.cursor()

    # Create session
    cursor.execute("""
        INSERT INTO scan_sessions (pack_id, image_path, trigger, scanned_at)
        VALUES (?, ?, ?, ?)
    """, (pack_id, "baseline.jpg", "manual", get_local_time()))

    session_id = cursor.lastrowid

    # Insert cavity states
    for cavity_id, (state, conf) in yolo_output.items():
        cursor.execute("""
            INSERT INTO cavity_snapshots
            (session_id, cavity_id, state, confidence, previous_state, captured_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (session_id, cavity_id, state, conf, None, get_local_time()))

    conn.commit()
    print("✅ Baseline stored successfully")

# ── MAIN ─────────────────────────────────────────────────────

def main():
    conn = get_conn()

    pack_id = str(uuid.uuid4())
    print("New Pack ID:", pack_id)

    register_pack(conn, pack_id, total_cavities=4)
    add_schedule(conn, pack_id)

    yolo_output = run_yolo()

    baseline_scan(conn, pack_id, yolo_output)

    conn.close()

if __name__ == "__main__":
    main()
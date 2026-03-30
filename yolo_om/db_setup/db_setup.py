import sqlite3

DB_PATH = "medcheck.db"


def create_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    # ── TABLE 1: packs ──
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS packs (
        pack_id TEXT PRIMARY KEY,
        patient_label TEXT,
        total_cavities INTEGER NOT NULL,
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # ── TABLE 2: dose_schedule ──
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dose_schedule (
        schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
        pack_id TEXT NOT NULL,
        cavity_id INTEGER NOT NULL,
        expected_time TEXT NOT NULL,
        day_label TEXT,
        FOREIGN KEY (pack_id) REFERENCES packs(pack_id)
    )
    """)

    # ── TABLE 3: scan_sessions ──
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS scan_sessions (
        session_id INTEGER PRIMARY KEY AUTOINCREMENT,
        pack_id TEXT NOT NULL,
        image_path TEXT,
        trigger TEXT DEFAULT 'manual',
        scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pack_id) REFERENCES packs(pack_id)
    )
    """)

    # ── TABLE 4: cavity_snapshots ──
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cavity_snapshots (
        snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        cavity_id INTEGER NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('intact', 'empty', 'partial', 'unknown')),
        confidence REAL NOT NULL DEFAULT 1.0,
        previous_state TEXT,
        captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES scan_sessions(session_id)
    )
    """)

    # ── TABLE 5: decision_events ──
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS decision_events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id INTEGER NOT NULL,
        decision_type TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'critical')),
        detail TEXT,
        decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (snapshot_id) REFERENCES cavity_snapshots(snapshot_id)
    )
    """)

    conn.commit()
    conn.close()

    print("✅ Database created successfully")

if __name__ == "__main__":
    create_db()
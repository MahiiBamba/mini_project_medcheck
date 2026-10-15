"""Read the authenticated user's recent scan history from MedCheck SQLite."""
from pathlib import Path
import json
import os
import sqlite3

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = Path(os.getenv("MEDCHECK_DB_PATH", str(PROJECT_ROOT / "server" / "medcheck.db")))


def get_user_history(user_id: int, days: int = 7, limit: int = 50) -> list[dict]:
    """Return only this user's scans from the previous `days` days."""
    if not DB_PATH.is_file():
        return []
    connection = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=3)
    connection.row_factory = sqlite3.Row
    try:
        rows = connection.execute(
            """
            SELECT id, image_name, total_detections, intact_count, broken_count,
                   visual_risk_score, visual_risk_level, created_at
            FROM scan_history
            WHERE user_id = ?
              AND datetime(created_at) >= datetime('now', ?)
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT ?
            """,
            (int(user_id), f"-{max(1, min(days, 30))} days", max(1, min(limit, 100))),
        ).fetchall()
        return [dict(row) for row in rows]
    except sqlite3.OperationalError:
        # The backend migration may not have run yet. No history is safer than a crash.
        return []
    finally:
        connection.close()

def get_user_health_history(user_id: int, days: int = 7) -> dict:
    """Return only the logged-in user's medication records, recent dose records and scans."""
    if not DB_PATH.is_file():
        return {"medications": [], "dose_history": [], "recent_scans": []}
    connection = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=3)
    connection.row_factory = sqlite3.Row
    try:
        medications = connection.execute(
            """SELECT id, name, dose, time, status, created_at
               FROM medications WHERE user_id = ? ORDER BY time ASC LIMIT 100""",
            (int(user_id),),
        ).fetchall()
        doses = connection.execute(
            """SELECT medication_id, scheduled_date, scheduled_time, status, taken_at
               FROM dose_records
               WHERE user_id = ? AND date(scheduled_date) >= date('now', ?)
               ORDER BY scheduled_date DESC, scheduled_time DESC LIMIT 100""",
            (int(user_id), f"-{max(1, min(days, 30))} days"),
        ).fetchall()
        scans = connection.execute(
            """SELECT image_name, total_detections, intact_count, broken_count,
                      visual_risk_score, visual_risk_level, created_at
               FROM scan_history
               WHERE user_id = ? AND datetime(created_at) >= datetime('now', ?)
               ORDER BY datetime(created_at) DESC, id DESC LIMIT 30""",
            (int(user_id), f"-{max(1, min(days, 30))} days"),
        ).fetchall()
        return {
            "window_days": max(1, min(days, 30)),
            "medications": [dict(row) for row in medications],
            "dose_history": [dict(row) for row in doses],
            "recent_scans": [dict(row) for row in scans],
        }
    except sqlite3.Error:
        # A history read failure should be visible to the caller, not mistaken for empty history.
        raise
    finally:
        connection.close()

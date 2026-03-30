import json
import sqlite3
from datetime import datetime
from agent import run_agent
from memory import build_memory_context

DB_PATH = "medcheck.db"
CONF_THRESHOLD = 0.6

# ── TIME HELPERS (LOCAL TIME) ─────────────────────────────

def now():
    return datetime.now()

def now_str():
    return now().strftime("%Y-%m-%d %H:%M:%S")

def parse_time(time_str):
    t = now()
    h, m = map(int, time_str.split(":"))
    return t.replace(hour=h, minute=m, second=0, microsecond=0)

# ── DB ─────────────────────────────────────────────

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ── GET PREVIOUS STATE ─────────────────────────────

def get_previous_state(conn, pack_id, cavity_id):
    row = conn.execute("""
        SELECT cs.state
        FROM cavity_snapshots cs
        JOIN scan_sessions ss ON ss.session_id = cs.session_id
        WHERE ss.pack_id=? AND cs.cavity_id=? AND cs.state!='unknown'
        ORDER BY cs.captured_at DESC
        LIMIT 1
    """, (pack_id, cavity_id)).fetchone()

    return row["state"] if row else None

# ── GET SCHEDULE ─────────────────────────────

def get_schedule(conn, pack_id, cavity_id):
    row = conn.execute("""
        SELECT expected_time
        FROM dose_schedule
        WHERE pack_id=? AND cavity_id=?
    """, (pack_id, cavity_id)).fetchone()

    return row["expected_time"] if row else None

# ── DECISION ENGINE ─────────────────────────────

def decide(state, prev_state, confidence, trigger, expected_time):

    results = []
    current_time = now()

    # low confidence
    if confidence < CONF_THRESHOLD:
        return [("low_confidence", "warning")]

    # baseline skip
    if prev_state is None:
        return []

    expected_dt = parse_time(expected_time) if expected_time else None

    # Rule 1: dose taken
    if prev_state == "intact" and state == "empty":
        if expected_dt:
            delta = abs((current_time - expected_dt).total_seconds() / 60)
            if delta <= 30:
                results.append(("dose_on_time", "info"))
            else:
                results.append(("dose_late", "warning"))
        else:
            results.append(("dose_taken", "info"))

    # Rule 2: double dose
    elif prev_state == "intact" and state == "empty":
        if trigger == "motion":
            results.append(("dose_taken", "info"))

    # Rule 3: missed dose
    elif prev_state == "intact" and state == "intact":
        if expected_dt:
            overdue = (current_time - expected_dt).total_seconds() / 60
            if overdue > 60:
                results.append(("missed_dose", "warning"))
            else:
                results.append(("waiting", "info"))
        else:
            results.append(("no_schedule", "info"))

    return results

# ── INGEST SECOND SCAN ─────────────────────────────


from agent import run_agent

def second_scan(pack_id, yolo_output, trigger=None):

    memory_context = build_memory_context(pack_id)

    # Combine rule output + memory
    agent_input = {
        "pack_id": pack_id,
        "trigger": trigger,
        "yolo_output": yolo_output,
        "memory": memory_context
    }

    result = run_agent(agent_input)

    print("\n--- AGENT OUTPUT ---")
    print(result)

    return result


# def second_scan(pack_id, yolo_output, trigger="motion"):
#     conn = get_conn()
#     cursor = conn.cursor()

#     # create session with local time
#     cursor.execute("""
#         INSERT INTO scan_sessions (pack_id, image_path, trigger, scanned_at)
#         VALUES (?, ?, ?, ?)
#     """, (pack_id, "scan2.jpg", trigger, now_str()))

#     session_id = cursor.lastrowid

#     for cid, (state, conf) in yolo_output.items():

#         prev_state = get_previous_state(conn, pack_id, cid)

#         # insert snapshot with time
#         cursor.execute("""
#             INSERT INTO cavity_snapshots
#             (session_id, cavity_id, state, confidence, previous_state, captured_at)
#             VALUES (?, ?, ?, ?, ?, ?)
#         """, (session_id, cid, state, conf, prev_state, now_str()))

#         snapshot_id = cursor.lastrowid

#         # fetch schedule
#         expected_time = get_schedule(conn, pack_id, cid)

#         # run decision
#         decisions = decide(
#             state,
#             prev_state,
#             conf,
#             trigger,
#             expected_time
#         )

#         # insert decisions with time
#         for d_type, severity in decisions:
#             cursor.execute("""
#                 INSERT INTO decision_events
#                 (snapshot_id, decision_type, severity, decided_at)
#                 VALUES (?, ?, ?, ?)
#             """, (snapshot_id, d_type, severity, now_str()))

#         print(f"Cavity {cid}: {prev_state} → {state} → {decisions}")

#     conn.commit()
#     conn.close()

# ── MAIN TEST ─────────────────────────────

def main():
    pack_id = input("Enter pack_id: ")

    # simulate second scan (modify to test)
    yolo_output = {
        # 1: ("empty", 0.95),   # taken
        # 2: ("empty", 0.93),   # taken
        # 3: ("intact", 0.91),
        # 4: ("intact", 0.90),
        #Enter pack_id: 78541a80-7306-4cec-b192-f41d7a80feb9
        #Cavity 1: intact → empty → [('dose_late', 'warning')]
        #avity 2: intact → empty → [('dose_late', 'warning')]
        #Cavity 3: intact → intact → [('waiting', 'info')]
        #Cavity 4: intact → intact → [('waiting', 'info')]
        # 1: ("empty", 0.95)
    }

    second_scan(pack_id, yolo_output, trigger="motion")

if __name__ == "__main__":
    main()
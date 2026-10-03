"""Approval queue. The AI only creates DRAFTS here; a record is written to the clinic database only after
the dentist clicks Approve (which calls the normal Express API)."""
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from . import config, clinic_api as api

DB_PATH = config.DATA_DIR / "drafts.db"
ENDPOINTS = {"appointment": "/appointments", "followup": "/followups", "consultation": "/consultations", "prescription": "/prescriptions"}


@contextmanager
def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("""CREATE TABLE IF NOT EXISTS drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER, patient_name TEXT, kind TEXT, payload TEXT,
        summary TEXT, warnings TEXT, status TEXT DEFAULT 'pending', created_at TEXT, decided_at TEXT)""")
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def _row(r) -> dict:
    d = dict(r)
    d["payload"] = json.loads(d["payload"])
    d["warnings"] = json.loads(d["warnings"] or "[]")
    return d


def create_draft(patient_id: int, patient_name: str, kind: str, payload: dict, summary: str, warnings: list | None = None) -> dict:
    if kind not in ENDPOINTS:
        raise ValueError(f"Unknown draft kind: {kind}")
    with _db() as c:
        cur = c.execute(
            "INSERT INTO drafts (patient_id, patient_name, kind, payload, summary, warnings, created_at) VALUES (?,?,?,?,?,?,?)",
            (patient_id, patient_name, kind, json.dumps(payload), summary, json.dumps(warnings or []), datetime.now().isoformat(timespec="seconds")))
        row = c.execute("SELECT * FROM drafts WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _row(row)


def list_drafts(patient_id: int | None = None, status: str = "pending") -> list[dict]:
    sql, args = "SELECT * FROM drafts WHERE status = ?", [status]
    if patient_id:
        sql, args = sql + " AND patient_id = ?", args + [patient_id]
    with _db() as c:
        return [_row(r) for r in c.execute(sql + " ORDER BY id DESC", args)]


def _get_pending(c, draft_id: int):
    row = c.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone()
    if not row:
        raise LookupError("Draft not found")
    if row["status"] != "pending":
        raise ValueError(f"Draft already {row['status']}")
    return row


def approve(draft_id: int) -> dict:
    with _db() as c:
        row = _get_pending(c, draft_id)
        payload = json.loads(row["payload"])
        created = api.post(ENDPOINTS[row["kind"]], {**payload, "patient_id": row["patient_id"]})  # real write happens here
        c.execute("UPDATE drafts SET status='approved', decided_at=? WHERE id=?", (datetime.now().isoformat(timespec="seconds"), draft_id))
    return {"ok": True, "created": created}


def reject(draft_id: int) -> dict:
    with _db() as c:
        _get_pending(c, draft_id)
        c.execute("UPDATE drafts SET status='rejected', decided_at=? WHERE id=?", (datetime.now().isoformat(timespec="seconds"), draft_id))
    return {"ok": True}

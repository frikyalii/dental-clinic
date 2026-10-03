"""The clinic's tool layer. These plain, typed functions are the single source of truth:
  - tools.py wraps them as LangChain tools for the LangGraph agent (with per-patient scoping)
  - mcp_server.py exposes the very same functions over MCP (FastMCP)
Read tools are safe. Draft tools never write to the clinic database - they only create approval-queue drafts."""
from datetime import date, time
from pydantic import BaseModel
from . import clinic_api as api, docs, drafts, rag, safety


class RxItem(BaseModel):
    medicine: str
    dosage: str = ""
    frequency: str = ""
    duration: str = ""
    instructions: str = ""


def _name(patient_id: int) -> str:
    return api.get(f"/patients/{patient_id}")["name"]  # also proves the patient exists


# ---------------- read tools ----------------
def find_patient(query: str) -> list[dict]:
    """Find patients by name, patient ID (e.g. PAT-001) or phone. Returns id, patient_code, name, age, current_treatment."""
    rows = api.get("/patients", q=query)
    return [{k: p[k] for k in ("id", "patient_code", "name", "age", "gender", "phone", "current_treatment")} for p in rows[:10]]


def get_patient_overview(patient_id: int) -> dict:
    """Snapshot of one patient: demographics, medical alerts (allergies, conditions, medications), treatments in progress,
    next appointment, billing totals and pending follow-ups."""
    return {"patient": api.get(f"/patients/{patient_id}"), **api.get(f"/patients/{patient_id}/overview")}


def search_patient_history(patient_id: int, query: str, k: int = 6) -> list[dict]:
    """Semantic search over one patient's records (consultations, diagnoses, treatment sessions, prescriptions,
    appointments, follow-ups, images, invoices). Use for questions like 'what happened with tooth 46?'.
    Each result has type, date and text - cite the type and date in answers."""
    return rag.search_history(patient_id, query, k)


def list_appointments(patient_id: int) -> list[dict]:
    """All appointments of a patient, newest first (date, time, type, status)."""
    return api.get(f"/patients/{patient_id}/appointments")


def get_billing(patient_id: int) -> list[dict]:
    """Invoices of a patient with total, paid and pending amounts (in rupees)."""
    return api.get(f"/patients/{patient_id}/billing")


def get_dental_chart(patient_id: int) -> list[dict]:
    """Per-tooth conditions recorded on the dental chart (FDI numbering)."""
    return api.get(f"/patients/{patient_id}/teeth")


def list_pending_payments(min_amount: float = 0) -> list[dict]:
    """All invoices across the clinic with a pending amount of at least min_amount rupees."""
    rows = [b for b in api.get("/billing") if b["pending"] > 0 and b["pending"] >= min_amount]
    return [{"patient_id": b["patient_id"], "patient": b["patient_name"], "treatment": b["treatment_name"], "pending": b["pending"]} for b in rows]


def list_todays_appointments() -> list[dict]:
    """Clinic-wide appointments scheduled for today."""
    today = date.today().isoformat()
    return [a for a in api.get("/appointments") if a["appointment_date"] == today]


def search_clinic_protocols(query: str) -> list[str]:
    """Search the clinic's own protocols (aftercare instructions, cautions). Contains no patient data."""
    return rag.search_protocols(query)


def search_documents(query: str, patient_id: int | None = None, k: int = 5) -> list[dict]:
    """Search uploaded documents: the clinic's protocols/guidelines, and - when patient_id is given - that patient's uploaded
    lab reports, referral letters, consent forms and medical reports. Each hit has title, page and text; cite title and page."""
    return docs.search_documents(query, patient_id, k)


def ask_documents(question: str, patient_id: int | None = None) -> dict:
    """Agentic RAG: routes the question, rewrites queries, retrieves from records and documents, grades the passages, answers with
    numbered citations and verifies the answer against the sources. Slower but more thorough than search_documents."""
    from . import agentic_rag
    return agentic_rag.ask(question, patient_id)


# ---------------- draft tools (need dentist approval) ----------------
def draft_appointment(patient_id: int, appointment_date: str, appointment_time: str, type: str, notes: str = "") -> dict:
    """Draft an appointment. appointment_date is YYYY-MM-DD, appointment_time is HH:MM (24h).
    The dentist must approve the draft before it is booked."""
    date.fromisoformat(appointment_date)
    time.fromisoformat(appointment_time)
    name = _name(patient_id)
    payload = {"appointment_date": appointment_date, "appointment_time": appointment_time, "type": type, "notes": notes, "status": "Scheduled"}
    d = drafts.create_draft(patient_id, name, "appointment", payload, f"Appointment for {name} on {appointment_date} at {appointment_time} ({type})")
    return {"draft_id": d["id"], "status": "pending dentist approval", "summary": d["summary"]}


def draft_followup(patient_id: int, followup_date: str, treatment: str = "", notes: str = "") -> dict:
    """Draft a follow-up reminder (followup_date is YYYY-MM-DD). The dentist must approve it."""
    date.fromisoformat(followup_date)
    name = _name(patient_id)
    payload = {"followup_date": followup_date, "treatment": treatment, "notes": notes, "status": "Pending"}
    d = drafts.create_draft(patient_id, name, "followup", payload, f"Follow-up for {name} on {followup_date}: {treatment or 'general'}")
    return {"draft_id": d["id"], "status": "pending dentist approval", "summary": d["summary"]}


def draft_consultation(patient_id: int, chief_complaint: str, duration: str = "", severity: str = "", symptom_location: str = "",
                       oral_hygiene: str = "", gum_condition: str = "", tooth_condition: str = "", other_findings: str = "",
                       dentist_notes: str = "") -> dict:
    """Draft a consultation note (severity: Mild/Moderate/Severe; oral_hygiene: Good/Fair/Poor). The dentist must approve it."""
    name = _name(patient_id)
    payload = dict(chief_complaint=chief_complaint, duration=duration, severity=severity, symptom_location=symptom_location,
                   oral_hygiene=oral_hygiene, gum_condition=gum_condition, tooth_condition=tooth_condition,
                   other_findings=other_findings, dentist_notes=dentist_notes)
    d = drafts.create_draft(patient_id, name, "consultation", payload, f"Consultation note for {name}: {chief_complaint}")
    return {"draft_id": d["id"], "status": "pending dentist approval", "summary": d["summary"]}


def draft_prescription(patient_id: int, items: list[RxItem], notes: str = "") -> dict:
    """Draft a prescription. Runs the allergy/interaction safety check automatically and attaches any warnings to the
    draft. The dentist must approve it. Always mention returned warnings in your answer."""
    name = _name(patient_id)
    rows = [i.model_dump() if isinstance(i, BaseModel) else dict(i) for i in items]
    warnings = safety.check_prescription(rows, api.get(f"/patients/{patient_id}/medical-history"))
    meds = ", ".join(r["medicine"] for r in rows)
    d = drafts.create_draft(patient_id, name, "prescription", {"items": rows, "notes": notes}, f"Prescription for {name}: {meds}", warnings)
    return {"draft_id": d["id"], "status": "pending dentist approval", "summary": d["summary"], "safety_warnings": warnings}


READ_TOOLS = [find_patient, get_patient_overview, search_patient_history, list_appointments, get_billing, get_dental_chart,
              list_pending_payments, list_todays_appointments, search_clinic_protocols, search_documents]
DRAFT_TOOLS = [draft_appointment, draft_followup, draft_consultation, draft_prescription]
ALL_TOOLS = READ_TOOLS + DRAFT_TOOLS
MCP_ONLY = [ask_documents]  # heavier multi-step pipeline: exposed to MCP clients, not nested inside the chat agent
# tools that look across patients - removed from the agent when a conversation is scoped to one patient
CROSS_PATIENT = {find_patient, list_pending_payments, list_todays_appointments}

"""RAG over a patient's structured records (consultations, diagnoses, treatments, ...) stored in Chroma with
metadata (patient_id, type, date). Every search is filtered by patient_id so data never leaks between patients.
Uploaded documents are handled in docs.py."""
import hashlib
import time
from langchain_core.documents import Document
from . import clinic_api as api, config, rerank, retrieval
from .vectorstore import store as _store

_last_indexed: dict[int, float] = {}


def _line(**fields) -> str:
    return "; ".join(f"{k.replace('_', ' ')}: {v}" for k, v in fields.items() if v not in (None, ""))


def build_docs(pid: int) -> list[tuple[str, Document]]:
    g = lambda path: api.get(f"/patients/{pid}{path}")
    out: list[tuple[str, Document]] = []

    def add(kind, rid, date, text, **meta):
        metadata = {"patient_id": pid, "type": kind, "date": (date or "")[:10], **meta}
        out.append((f"{pid}-{kind}-{rid}", Document(page_content=text, metadata={k: v for k, v in metadata.items() if v is not None})))

    m = g("/medical-history")
    if m:
        add("medical_history", 0, "", "Medical history - " + _line(allergies=m.get("allergies"), conditions=m.get("medical_conditions"),
            medications=m.get("current_medications"), surgeries=m.get("previous_surgeries"), blood_group=m.get("blood_group"),
            tobacco=m.get("tobacco_history"), notes=m.get("notes")))
    for h in g("/dental-history"):
        add("dental_history", h["id"], h["treatment_date"], f"Previous dental treatment on {h['treatment_date']}: " + _line(treatment=h["treatment_type"], notes=h["notes"]))
    for c in g("/consultations"):
        add("consultation", c["id"], c["created_at"], f"Consultation on {c['created_at'][:10]} - " + _line(
            complaint=c["chief_complaint"], duration=c["duration"], severity=c["severity"], location=c["symptom_location"],
            oral_hygiene=c["oral_hygiene"], gums=c["gum_condition"], teeth=c["tooth_condition"], findings=c["other_findings"], dentist_notes=c["dentist_notes"]))
    for d in g("/diagnoses"):
        add("diagnosis", d["id"], d["diagnosis_date"], f"Diagnosis on {d['diagnosis_date']} - " + _line(diagnosis=d["diagnosis"], tooth=d["tooth_number"], notes=d["notes"]), tooth_number=d["tooth_number"])
    for t in g("/treatments"):
        add("treatment", t["id"], t["created_at"], f"Treatment plan - " + _line(name=t["name"], tooth=t["tooth_number"], diagnosis=t["diagnosis"],
            status=t["status"], cost=t["cost"], planned_sessions=t["sessions_planned"], notes=t["notes"]), tooth_number=t["tooth_number"])
        for n, s in enumerate(t["sessions"], 1):
            add("session", s["id"], s["session_date"], f"Session {n} of {t['name']} (tooth {t['tooth_number']}) on {s['session_date']}: {s['notes'] or ''}", tooth_number=t["tooth_number"])
    for rx in g("/prescriptions"):
        meds = "; ".join(_line(medicine=i["medicine"], dosage=i["dosage"], frequency=i["frequency"], duration=i["duration"], instructions=i["instructions"]) for i in rx["items"])
        add("prescription", rx["id"], rx["created_at"], f"Prescription on {rx['created_at'][:10]}: {meds}. {rx['notes'] or ''}")
    for a in g("/appointments"):
        add("appointment", a["id"], a["appointment_date"], f"Appointment on {a['appointment_date']} {a['appointment_time']}: " + _line(type=a["type"], status=a["status"], notes=a["notes"]))
    for f in g("/followups"):
        add("followup", f["id"], f["followup_date"], f"Follow-up due {f['followup_date']}: " + _line(treatment=f["treatment"], status=f["status"], notes=f["notes"]))
    for i in g("/images"):
        add("image", i["id"], i["taken_date"], f"{i['image_type']} taken {i['taken_date']}: " + _line(tooth=i["tooth_number"], description=i["description"], notes=i["notes"]), tooth_number=i["tooth_number"])
    for b in g("/billing"):
        add("invoice", b["id"], b["created_at"], f"Invoice for {b['treatment_name']} on {b['created_at'][:10]}: total Rs {b['total']}, paid Rs {b['paid']}, pending Rs {b['pending']}")
    return out


def index_patient(pid: int) -> int:
    """Sync one patient's records into the vector store. Only new/changed records are embedded (saves free-tier quota)."""
    store = _store("patient_history")
    existing = store.get(where={"patient_id": pid}, include=["metadatas"])
    old = {i: (m or {}).get("hash") for i, m in zip(existing["ids"], existing["metadatas"])}
    items = build_docs(pid)
    for _, d in items:
        d.metadata["hash"] = hashlib.sha1(d.page_content.encode()).hexdigest()[:16]
    stale = [i for i in old if i not in {i for i, _ in items}]
    if stale:
        store.delete(ids=stale)
    changed = [(i, d) for i, d in items if old.get(i) != d.metadata["hash"]]
    if changed:
        store.add_documents([d for _, d in changed], ids=[i for i, _ in changed])
    _last_indexed[pid] = time.time()
    return len(changed)


def index_all() -> int:
    return sum(index_patient(p["id"]) for p in api.get("/patients"))


def search_history(pid: int, query: str, k: int = 6, use_rerank: bool = True) -> list[dict]:
    if time.time() - _last_indexed.get(pid, 0) > config.REINDEX_AFTER_SECONDS:
        index_patient(pid)  # sync changed records into the index
    docs = retrieval.hybrid_search("patient_history", query, {"patient_id": pid}, k * 3 if use_rerank else k)
    items = [{"type": d.metadata["type"], "date": d.metadata.get("date", ""), "text": d.page_content} for d in docs]
    return rerank.rerank(query, items, k) if use_rerank else items


# ---- clinic protocols now live in the document store (docs.py) ----
def index_protocols(force: bool = False) -> int:
    from . import docs
    return docs.seed_knowledge(force)


def search_protocols(query: str, k: int = 3) -> list[str]:
    from . import docs
    return [h["text"] for h in docs.search_documents(query, None, k)]

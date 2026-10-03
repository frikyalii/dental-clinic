"""Single-purpose LangChain chains: pre-visit brief, dictation -> consultation form, patient instructions."""
import json
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from . import clinic_api as api, rag
from .llm import get_llm


def gather_context(pid: int) -> str:
    g = lambda path: api.get(f"/patients/{pid}{path}")
    ctx = {
        "patient": g(""), "overview": g("/overview"),
        "recent_dental_history": g("/dental-history")[:8],
        "recent_consultations": g("/consultations")[:3], "diagnoses": g("/diagnoses")[:6],
        "treatments": g("/treatments"), "appointments": g("/appointments")[:8],
        "followups": g("/followups")[:8], "billing": g("/billing"),
    }
    return json.dumps(ctx, default=str, ensure_ascii=False)[:14000]


BRIEF = ChatPromptTemplate.from_messages([
    ("system", "You prepare a pre-visit brief for a dentist from the patient's records. Use ONLY the JSON provided. "
               "Format: 1) one-line patient summary; 2) ALERTS (allergies, conditions, medications) first; 3) current treatment and "
               "progress (sessions done/planned, last session notes); 4) upcoming appointment and open follow-ups; 5) pending payment. "
               "Max 180 words, plain text with short lines, no invented facts. If something is missing, say 'not recorded'."),
    ("human", "Today: {today}\nRecords:\n{context}"),
])


def patient_brief(pid: int) -> str:
    from datetime import date
    return (BRIEF | get_llm() | StrOutputParser()).invoke({"context": gather_context(pid), "today": date.today().isoformat()})


class ConsultationNote(BaseModel):
    chief_complaint: str = Field(description="Prefer one of: Tooth pain, Sensitivity, Swelling, Bleeding gums, Broken tooth. Otherwise a short free-text complaint.")
    duration: str = Field("", description="e.g. '3 days'")
    severity: str = Field("", description="Mild, Moderate or Severe, or empty if not mentioned")
    symptom_location: str = Field("", description="e.g. 'lower right'")
    oral_hygiene: str = Field("", description="Good, Fair or Poor, or empty if not mentioned")
    gum_condition: str = Field("", description="Healthy, Gingivitis, Periodontitis, Bleeding or Swollen, or empty")
    tooth_condition: str = Field("", description="Tooth findings including tooth numbers")
    other_findings: str = Field("", description="Other examination findings")
    dentist_notes: str = Field("", description="Clean, professional summary of the dentist's notes incl. any diagnosis or plan mentioned")


def extract_consultation(text: str) -> dict:
    """Dictation / rough notes -> structured consultation fields (only what was actually said; the dentist reviews before saving)."""
    llm = get_llm().with_structured_output(ConsultationNote, method="function_calling")
    prompt = ("Extract consultation fields from the dentist's rough notes. Do not invent anything that is not in the notes; "
              "leave a field empty if it was not mentioned.\n\nNotes:\n" + text)
    return llm.invoke(prompt).model_dump()


INSTRUCTIONS = ChatPromptTemplate.from_messages([
    ("system", "Write patient-friendly aftercare / care instructions in {language}, at a simple reading level. "
               "Use a short bullet list (max 220 words) and end with when to contact the clinic. Adapt to the patient's medical alerts "
               "where relevant (mention allergies/conditions only if they change the advice). Base the advice on the clinic protocols provided; "
               "do NOT invent medicine names or doses. Format in clean Markdown: short **bold** section titles on their own line, then bullet lists using '- '. No tables."),
    ("human", "Topic: {topic}\nPatient age/gender: {age} / {gender}\nMedical alerts: {alerts}\nClinic protocols:\n{protocols}"),
])


def patient_instructions(pid: int, topic: str, language: str) -> dict:
    p = api.get(f"/patients/{pid}")
    m = api.get(f"/patients/{pid}/medical-history") or {}
    alerts = "; ".join(f"{k}: {m[k]}" for k in ("allergies", "medical_conditions", "current_medications") if m.get(k)) or "none recorded"
    text = (INSTRUCTIONS | get_llm() | StrOutputParser()).invoke({
        "language": language, "topic": topic, "age": p["age"], "gender": p["gender"], "alerts": alerts,
        "protocols": "\n---\n".join(rag.search_protocols(topic))})
    return {"text": text, "patient_name": p["name"], "language": language}

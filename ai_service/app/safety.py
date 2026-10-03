"""Deterministic prescription safety rules (no LLM involved).

IMPORTANT: this rule table is a small illustrative starter set. It is NOT a complete drug database and
does not replace clinical judgement or a licensed drug-interaction reference. Extend it for your clinic.
"""
from dataclasses import dataclass

PENICILLINS = ["penicillin", "amoxicillin", "amoxycillin", "ampicillin", "augmentin", "amox", "cloxacillin"]
CEPHALOSPORINS = ["cef", "ceph"]
NSAIDS = ["ibuprofen", "diclofenac", "aspirin", "naproxen", "ketorolac", "aceclofenac", "nimesulide", "etoricoxib"]
STEROIDS = ["dexamethasone", "prednisolone", "prednisone", "hydrocortisone"]


@dataclass
class Rule:
    drugs: list[str]       # matched against the medicine name
    field: str             # 'allergies' or 'other' (conditions + current medications + notes)
    triggers: list[str]    # matched against that field
    level: str             # 'high' | 'medium'
    message: str


RULES = [
    Rule(PENICILLINS, "allergies", ["penicillin", "amoxicillin", "ampicillin", "beta-lactam"], "high",
         "Patient has a recorded penicillin allergy."),
    Rule(CEPHALOSPORINS, "allergies", ["penicillin", "cephalosporin"], "medium",
         "Possible cross-reactivity between penicillin and cephalosporin allergy."),
    Rule(NSAIDS, "allergies", ["nsaid", "aspirin", "ibuprofen", "diclofenac"], "high",
         "Patient has a recorded NSAID / aspirin allergy."),
    Rule(NSAIDS, "other", ["ulcer", "gastritis", "kidney", "renal", "warfarin", "anticoag", "clopidogrel"], "medium",
         "NSAIDs can worsen ulcers/kidney disease and raise bleeding risk with anticoagulants."),
    Rule(NSAIDS, "other", ["asthma"], "medium", "NSAIDs/aspirin can trigger bronchospasm in some asthma patients."),
    Rule(["metronidazole", "tinidazole"], "other", ["warfarin"], "high", "Metronidazole strongly increases warfarin effect (bleeding risk)."),
    Rule(["sulfamethoxazole", "cotrimoxazole", "co-trimoxazole"], "allergies", ["sulfa", "sulpha"], "high",
         "Patient has a recorded sulfa allergy."),
    Rule(STEROIDS, "other", ["diabet"], "medium", "Corticosteroids can raise blood glucose in diabetic patients."),
    Rule(["tetracycline", "doxycycline", "minocycline"], "other", ["pregnan"], "high", "Tetracyclines are generally avoided in pregnancy."),
]


def check_prescription(items: list[dict], medical: dict | None) -> list[dict]:
    m = medical or {}
    allergies = (m.get("allergies") or "").lower()
    other = " ".join((m.get(k) or "") for k in ("medical_conditions", "current_medications", "notes")).lower()
    warnings, seen = [], set()

    for it in items:
        name = (it.get("medicine") or "").strip()
        low = name.lower()
        if not low:
            continue
        if low in seen:
            warnings.append({"level": "medium", "drug": name, "message": "Medicine appears more than once in this prescription."})
        seen.add(low)
        # direct match against the allergy text, e.g. allergy "Ibuprofen" and medicine "Ibuprofen 400"
        if any(len(word) > 3 and word in allergies for word in low.replace("-", " ").split()):
            warnings.append({"level": "high", "drug": name, "message": f"'{name}' matches a recorded allergy ({m.get('allergies')})."})
        for r in RULES:
            text = allergies if r.field == "allergies" else other
            if any(d in low for d in r.drugs) and any(t in text for t in r.triggers):
                warnings.append({"level": r.level, "drug": name, "message": r.message})

    unique = {(w["drug"], w["message"]): w for w in warnings}  # de-duplicate
    return sorted(unique.values(), key=lambda w: w["level"] != "high")

"""Agentic RAG as a LangGraph state machine.

  route -> rewrite -> retrieve -> grade --(nothing relevant & attempts left)--> rewrite (retry with feedback)
                                      +--> generate -> verify --(unsupported claims & retries left)--> generate
                                                          +--> END
  route --(no retrieval needed)--> direct -> END

- route:    decide which sources to search (patient records / patient documents / clinic documents)
- rewrite:  1-3 focused queries (expand abbreviations, split multi-part questions)
- retrieve: hybrid search (vector + BM25) over each chosen source, fuse and de-duplicate
- rerank + grade: the reranker scores every passage 0-10 against the question in one call; low scores are dropped (relevance filter)
- generate: answer ONLY from the numbered passages, with [n] citations
- verify:   LLM checks every claim is supported; if not, regenerate once with the problems listed
Scope is enforced by the server: without a patient_id only clinic documents are searchable.
"""
import hashlib
import operator
import re
from functools import lru_cache
from typing import Annotated, Literal, TypedDict
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field
from . import docs, rag, rerank
from .llm import get_llm, require_token

MAX_ATTEMPTS = 2
RELEVANT_MIN = 5  # reranker score (0-10) a passage needs to be used
POOL = 15         # candidates handed to the reranker
SOURCE_LABEL = {"records": "Patient record", "patient_docs": "Patient document", "clinic_docs": "Clinic document"}


class Route(BaseModel):
    needs_retrieval: bool = Field(description="False only for greetings, thanks or chit-chat that needs no records or documents")
    sources: list[Literal["records", "patient_docs", "clinic_docs"]] = Field(description="Minimum set of sources to search")
    reason: str = Field("", description="One short sentence")


class Rewrite(BaseModel):
    queries: list[str] = Field(description="1 to 3 short, distinct search queries")


class Verdict(BaseModel):
    grounded: bool = Field(description="True only if every factual claim in the answer is supported by the context")
    unsupported_claims: list[str] = Field(default_factory=list)


class State(TypedDict, total=False):
    question: str
    patient_id: int | None
    allowed: list[str]
    sources: list[str]
    needs_retrieval: bool
    queries: list[str]
    feedback: str
    attempts: int
    candidates: list[dict]
    relevant: list[dict]
    answer: str
    grounded: bool
    issues: list[str]
    gen_attempts: int
    trace: Annotated[list[str], operator.add]


def _structured(schema, system: str, human: str, fallback):
    """Structured LLM call. Free models sometimes fail schema output, so every step has a safe fallback."""
    try:
        llm = get_llm().with_structured_output(schema, method="function_calling")
        return llm.invoke([SystemMessage(content=system), HumanMessage(content=human)])
    except Exception:
        return fallback


def _text(system: str, human: str) -> str:
    content = get_llm().invoke([SystemMessage(content=system), HumanMessage(content=human)]).content
    if isinstance(content, str):
        return content
    return "".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")


def _label(c: dict) -> str:
    bits = [SOURCE_LABEL[c["source"]], c["title"]]
    if c.get("page"):
        bits.append(f"p.{c['page']}")
    if c.get("ocr"):
        bits.append("OCR text, may contain errors")
    if c.get("date"):
        bits.append(c["date"])
    return " | ".join(bits)


# ---------------- nodes ----------------
def route(state: State):
    allowed = state["allowed"]
    r = _structured(
        Route,
        "You route questions for a dentist's assistant. Sources: records = this patient's chart records (consultations, diagnoses, "
        "treatments, prescriptions, appointments, invoices); patient_docs = documents uploaded for this patient (lab reports, referral "
        "letters, consent forms); clinic_docs = clinic protocols, guidelines and general reference. Choose the minimum sources needed. "
        f"Available: {allowed}.",
        state["question"], Route(needs_retrieval=True, sources=allowed, reason=""))
    sources = [s for s in r.sources if s in allowed] or allowed
    note = ("search " + ", ".join(sources)) if r.needs_retrieval else "no search needed"
    return {"needs_retrieval": r.needs_retrieval, "sources": sources, "attempts": 0, "gen_attempts": 0,
            "trace": [f"Routing: {note}" + (f" ({r.reason})" if r.reason else "")]}


def rewrite(state: State):
    fb = state.get("feedback", "")
    r = _structured(
        Rewrite,
        "Write 1-3 short, distinct search queries for a dental knowledge base. Expand abbreviations (RCT = root canal treatment, "
        "OPG = panoramic x-ray), keep tooth numbers and drug names exactly as written, and split multi-part questions.",
        f"Question: {state['question']}\n" + (f"Previous queries: {state.get('queries')}\n{fb}" if fb else ""),
        Rewrite(queries=[state["question"]]))
    queries = [q.strip() for q in r.queries if q.strip()][:3] or [state["question"]]
    n = state["attempts"] + 1
    return {"queries": queries, "attempts": n, "trace": [f"Search queries (attempt {n}): " + " | ".join(queries)]}


def _search(source: str, query: str, pid: int | None) -> list[dict]:
    if source == "records" and pid:
        try:
            hits = rag.search_history(pid, query, 8, use_rerank=False)  # reranking happens once, later, across all sources
        except Exception:
            return []  # e.g. the clinic API is down: documents can still answer
        return [{"source": source, "title": f"{h['type']} record", "page": 0, "date": h["date"], "doc_id": None, "ocr": 0, "text": h["text"]} for h in hits]
    if source == "patient_docs" and pid:
        hits = docs.search_scope(query, pid, 8)
    elif source == "clinic_docs":
        docs.ensure_seeded()
        hits = docs.search_scope(query, 0, 8)
    else:
        return []
    return [{"source": source, "title": h["title"], "page": h["page"], "date": "", "doc_id": h["doc_id"], "ocr": h.get("ocr", 0), "text": h["text"]} for h in hits]


def retrieve(state: State):
    found: dict[str, dict] = {}
    for q in state["queries"]:
        for src in state["sources"]:
            for rank, item in enumerate(_search(src, q, state.get("patient_id"))):
                key = hashlib.sha1(item["text"].encode()).hexdigest()
                found.setdefault(key, {**item, "score": 0.0})["score"] += 1 / (60 + rank)  # fuse across queries/sources
    cands = sorted(found.values(), key=lambda c: -c["score"])[:POOL]
    for i, c in enumerate(cands, 1):
        c["id"] = i
    return {"candidates": cands}


def grade(state: State):
    """Rerank + relevance filter in one LLM call: score every candidate 0-10, order by score, keep the useful ones."""
    cands = state["candidates"]
    if not cands:
        return {"relevant": [], "feedback": "Nothing was found. Try synonyms or broader terms.", "trace": ["Retrieved 0 passages"]}
    scores = rerank.score_passages(state["question"], cands)
    if scores is None:  # reranking off or unavailable: fall back to the best retrieval hits
        keep = cands[:5]
        note = f"Retrieved {len(cands)} passages; reranker unavailable, kept the top {len(keep)} by retrieval order"
    else:
        ranked = sorted(zip(cands, scores), key=lambda x: (-x[1], x[0]["id"]))
        keep = [{**c, "rerank_score": s} for c, s in ranked if s >= RELEVANT_MIN][:6]
        note = f"Retrieved {len(cands)} passages, reranked by relevance, kept {len(keep)} scoring {RELEVANT_MIN}+ out of 10"
    for n, c in enumerate(keep, 1):
        c["n"] = n  # citation number used in the answer
    fb = "" if keep else "Retrieved passages were not relevant. Try different wording or a broader query."
    return {"relevant": keep, "feedback": fb, "trace": [note]}


def after_grade(state: State) -> str:
    return "rewrite" if not state["relevant"] and state["attempts"] < MAX_ATTEMPTS else "generate"


def _context(rel: list[dict]) -> str:
    return "\n\n".join(f"[{c['n']}] {_label(c)}\n{c['text']}" for c in rel)


def generate(state: State):
    rel = state["relevant"]
    if not rel:
        return {"answer": "I couldn't find this in the available records and documents.", "grounded": True, "issues": [],
                "trace": ["No relevant sources - declined to answer instead of guessing"]}
    system = ("You answer a dentist's question using ONLY the numbered context. Put the source number in brackets after each claim, "
              "like [1]. If the context answers only part of the question, say what is missing. Never invent facts, doses or dates. Be concise.")
    if state.get("issues"):
        system += " A previous draft contained unsupported claims - remove or correct them: " + "; ".join(state["issues"])
    answer = _text(system, f"Question: {state['question']}\n\nContext:\n{_context(rel)}")
    return {"answer": answer, "gen_attempts": state["gen_attempts"] + 1, "trace": [f"Drafted answer from {len(rel)} sources"]}


def after_generate(state: State) -> str:
    return "verify" if state["relevant"] else END


def verify(state: State):
    v = _structured(
        Verdict,
        "You are a strict fact checker. Decide whether every factual claim in the ANSWER is supported by the CONTEXT. "
        "List any unsupported claims.",
        f"CONTEXT:\n{_context(state['relevant'])}\n\nANSWER:\n{state['answer']}", None)
    if v is None:
        return {"grounded": True, "issues": [], "trace": ["Verification unavailable - please check the citations yourself"]}
    return {"grounded": v.grounded, "issues": v.unsupported_claims,
            "trace": ["Verified: every claim is supported by the sources" if v.grounded else f"Verification found {len(v.unsupported_claims)} unsupported claim(s)"]}


def after_verify(state: State) -> str:
    return "generate" if not state["grounded"] and state["gen_attempts"] < MAX_ATTEMPTS else END


def direct(state: State):
    text = _text("You are the assistant inside a dentist's clinic system. Reply briefly. If asked about a specific patient or document, "
                 "ask the dentist to rephrase so you can search the records.", state["question"])
    return {"answer": text, "grounded": True, "relevant": [], "issues": []}


@lru_cache
def _graph():
    g = StateGraph(State)
    for name, fn in [("route", route), ("rewrite", rewrite), ("retrieve", retrieve), ("grade", grade),
                     ("generate", generate), ("verify", verify), ("direct", direct)]:
        g.add_node(name, fn)
    g.add_edge(START, "route")
    g.add_conditional_edges("route", lambda s: "rewrite" if s["needs_retrieval"] else "direct", {"rewrite": "rewrite", "direct": "direct"})
    g.add_edge("rewrite", "retrieve")
    g.add_edge("retrieve", "grade")
    g.add_conditional_edges("grade", after_grade, {"rewrite": "rewrite", "generate": "generate"})
    g.add_conditional_edges("generate", after_generate, {"verify": "verify", END: END})
    g.add_conditional_edges("verify", after_verify, {"generate": "generate", END: END})
    g.add_edge("direct", END)
    return g.compile()


def ask(question: str, patient_id: int | None = None) -> dict:
    require_token()
    allowed = ["records", "patient_docs", "clinic_docs"] if patient_id else ["clinic_docs"]
    out = _graph().invoke({"question": question, "patient_id": patient_id, "allowed": allowed, "trace": []}, {"recursion_limit": 25})

    answer = out.get("answer", "")
    used = {int(n) for n in re.findall(r"\[(\d+)\]", answer)}
    citations = [{"n": c["n"], "source": SOURCE_LABEL[c["source"]], "title": c["title"], "page": c["page"], "date": c.get("date", ""),
                  "doc_id": c.get("doc_id"), "ocr": c.get("ocr", 0), "snippet": c["text"][:300]}
                 for c in out.get("relevant", []) if not used or c["n"] in used]
    return {"answer": answer, "citations": citations, "grounded": out.get("grounded", True), "issues": out.get("issues", []),
            "trace": out.get("trace", []), "sources_searched": out.get("sources", [])}

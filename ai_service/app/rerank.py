"""Reranking: re-score retrieved passages against the question and put the best first.

Hybrid retrieval (vector + BM25) is fast but approximate. A reranker reads each passage together with the question and judges
relevance directly, which fixes many near-miss orderings. Backend "llm" asks the hosted chat model to give each passage a 0-10 score
in ONE call (a hosted cross-encoder such as bge-reranker is not reliably available on the free Hugging Face tier, so the backend is
pluggable: add another branch in score_passages to use one). Any failure falls back to the original retrieval order."""
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, SystemMessage
from . import config
from .llm import get_llm

SYSTEM = ("You are a relevance judge for a dental clinic knowledge base. For each numbered passage, give an integer score from 0 to 10 "
          "for how useful it is for answering the question: 10 = directly answers it, 5 = partly useful, 0 = unrelated. "
          "Judge only the passage text. Return a score for EVERY passage.")


class PassageScore(BaseModel):
    id: int = Field(description="passage number")
    score: int = Field(ge=0, le=10)


class Scores(BaseModel):
    scores: list[PassageScore]


def score_passages(query: str, items: list[dict], backend: str | None = None) -> list[int] | None:
    """Scores aligned with items (0-10), or None if reranking is off or failed."""
    backend = (backend or config.RERANK_BACKEND).lower()
    if backend == "none" or not items:
        return None
    listing = "\n\n".join(f"[{i}] {it['text'][:600]}" for i, it in enumerate(items, 1))
    try:
        llm = get_llm().with_structured_output(Scores, method="function_calling")
        out = llm.invoke([SystemMessage(content=SYSTEM), HumanMessage(content=f"Question: {query}\n\nPassages:\n{listing}")])
    except Exception:
        return None
    by_id = {s.id: s.score for s in out.scores}
    if len(by_id) < max(1, len(items) // 2):  # the model skipped most passages: don't trust it
        return None
    return [by_id.get(i, 0) for i in range(1, len(items) + 1)]


def rerank(query: str, items: list[dict], top_n: int, backend: str | None = None) -> list[dict]:
    scores = score_passages(query, items, backend)
    if scores is None:
        return items[:top_n]
    order = sorted(range(len(items)), key=lambda i: (-scores[i], i))  # ties keep the retrieval order
    return [{**items[i], "rerank_score": scores[i]} for i in order[:top_n]]

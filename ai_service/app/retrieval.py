"""Hybrid retrieval: semantic (vector) search + keyword (BM25) search, fused with Reciprocal Rank Fusion.
Vectors catch meaning ("tooth pain" ~ "toothache"); BM25 catches exact terms (tooth numbers, drug names, codes)."""
import hashlib
import re
from langchain_core.documents import Document
from . import vectorstore

RRF_K = 60
_TOKEN = re.compile(r"[^\s.,;:!?()\[\]{}\"'/\\-]+")


def _tokens(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


def hybrid_search(collection: str, query: str, where: dict, k: int = 5, pool: int = 12) -> list[Document]:
    from rank_bm25 import BM25Okapi
    st = vectorstore.store(collection)
    vector_hits = st.similarity_search(query, k=pool, filter=where)

    got = st.get(where=where, include=["documents", "metadatas"])
    keyword_hits: list[Document] = []
    if got["documents"] and _tokens(query):
        scores = BM25Okapi([_tokens(t) for t in got["documents"]]).get_scores(_tokens(query))
        order = sorted(range(len(scores)), key=lambda i: -scores[i])[:pool]
        keyword_hits = [Document(page_content=got["documents"][i], metadata=got["metadatas"][i]) for i in order if scores[i] > 0]

    fused: dict[str, list] = {}
    for hits in (vector_hits, keyword_hits):
        for rank, doc in enumerate(hits):
            key = hashlib.sha1(doc.page_content.encode()).hexdigest()
            fused.setdefault(key, [doc, 0.0])[1] += 1 / (RRF_K + rank)
    return [d for d, _ in sorted(fused.values(), key=lambda x: -x[1])[:k]]

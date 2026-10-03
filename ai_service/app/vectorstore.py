"""Hosted embeddings (Hugging Face inference API, free tier) and the Chroma vector store."""
import math
import re
import time
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
import httpx
from langchain_core.embeddings import Embeddings
from . import config

EMBED_URL = "https://router.huggingface.co/hf-inference/models/{model}/pipeline/feature-extraction"
BATCH = 16


def _to_sentence_vector(item) -> list[float]:
    """The API returns either one vector per text or token-level vectors (average those), then L2-normalise."""
    if item and isinstance(item[0], list):
        n = len(item)
        vec = [sum(col) / n for col in zip(*item)]
    else:
        vec = [float(x) for x in item]
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


class HFApiEmbeddings(Embeddings):
    """Embeddings from the Hugging Face hosted inference API (free tier), called directly over HTTPS -
    no huggingface_hub / numpy needed, and nothing runs on your machine."""

    def __init__(self, model: str, token: str):
        self.url = EMBED_URL.format(model=model)
        self.headers = {"Authorization": f"Bearer {token}"}

    def _embed_batch(self, texts: list[str]) -> list[list[float]]:
        last = ""
        for attempt in range(4):
            r = httpx.post(self.url, headers=self.headers, json={"inputs": texts, "options": {"wait_for_model": True}}, timeout=120)
            if r.status_code in (429, 503):  # rate limited / model warming up: wait and retry
                last = f"{r.status_code} {r.text[:120]}"
                time.sleep(2 * (attempt + 1))
                continue
            if r.status_code >= 400:
                raise RuntimeError(f"Hugging Face embedding API error {r.status_code}: {r.text[:300]}")
            data = r.json()
            if isinstance(data, dict):
                raise RuntimeError(f"Hugging Face embedding API error: {data.get('error', data)}")
            return [_to_sentence_vector(x) for x in data]
        raise RuntimeError(f"Hugging Face embedding API is busy or rate limited ({last}). Try again in a minute.")

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        batches = [texts[i:i + BATCH] for i in range(0, len(texts), BATCH)]
        with ThreadPoolExecutor(max_workers=3) as pool:
            return [v for part in pool.map(self._embed_batch, batches) for v in part]

    def embed_query(self, text: str) -> list[float]:
        return self._embed_batch([text])[0]


@lru_cache
def embeddings() -> Embeddings:
    from .llm import require_token
    require_token()
    return HFApiEmbeddings(config.EMBED_MODEL, config.HF_TOKEN)


@lru_cache
def store(name: str):
    from langchain_chroma import Chroma
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", config.EMBED_MODEL).strip("-")  # a different embedding model gets its own index
    return Chroma(collection_name=name, embedding_function=embeddings(), persist_directory=str(config.DATA_DIR / f"chroma-{slug}"))

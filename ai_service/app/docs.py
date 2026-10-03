"""Document pipeline: upload -> parse (PDF/DOCX/TXT/MD/images) -> OCR for scanned pages -> chunk -> embed -> Chroma, plus a SQLite registry.
Scope: patient_id = 0 means a clinic-wide document (protocols, guidelines); otherwise it belongs to that patient."""
import hashlib
import io
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from langchain_core.documents import Document
from itertools import zip_longest
from . import config, ocr, rerank, retrieval
from .vectorstore import store

COLLECTION = "documents"
FILES_DIR = config.DATA_DIR / "files"
FILES_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = config.DATA_DIR / "documents.db"
_seeded = False


@contextmanager
def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("""CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT, patient_id INTEGER, doc_type TEXT, sha TEXT,
        pages INTEGER DEFAULT 0, chunks INTEGER DEFAULT 0, size INTEGER, stored_name TEXT, uploaded_at TEXT, ocr INTEGER DEFAULT 0)""")
    if "ocr" not in {r["name"] for r in conn.execute("PRAGMA table_info(documents)")}:  # upgrade older databases
        conn.execute("ALTER TABLE documents ADD COLUMN ocr INTEGER DEFAULT 0")
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def parse(filename: str, data: bytes) -> list[tuple[int, str]]:
    """Returns [(page_number or 0, text)]."""
    ext = Path(filename).suffix.lower()
    if ext in ocr.IMAGE_EXT:
        return [(1, "")]  # no text layer: filled in by OCR
    if ext == ".pdf":
        from pypdf import PdfReader
        return [(i + 1, p.extract_text() or "") for i, p in enumerate(PdfReader(io.BytesIO(data)).pages)]
    if ext == ".docx":
        import docx
        d = docx.Document(io.BytesIO(data))
        lines = [p.text for p in d.paragraphs]
        for t in d.tables:
            lines += [" | ".join(c.text.strip() for c in row.cells) for row in t.rows]
        return [(0, "\n".join(lines))]
    if ext in (".txt", ".md", ".csv"):
        return [(0, data.decode("utf-8", errors="ignore"))]
    raise ValueError(f"Unsupported file type '{ext}'. Upload PDF, DOCX, TXT, MD, PNG or JPG.")


def _apply_ocr(filename: str, data: bytes, pages: list[tuple[int, str]]):
    """OCR pages that have no text layer (scanned PDFs, photos). Returns (pages, pages_that_used_ocr)."""
    ext = Path(filename).suffix.lower()
    empty = [n for n, t in pages if len(t.strip()) < 20]
    has_text = any(t.strip() for _, t in pages)
    if not empty or (ext != ".pdf" and ext not in ocr.IMAGE_EXT):
        return pages, []
    if not ocr.enabled():
        if not has_text:
            raise ValueError("No readable text found (scanned PDF or image). Set OCR_BACKEND=vlm (hosted vision model) or "
                             "tesseract in ai_service/.env to read scanned documents.")
        return pages, []
    try:
        got = ocr.ocr_pdf_pages(data, empty) if ext == ".pdf" else {1: ocr.ocr_image_bytes(data)}
    except Exception as e:
        if has_text:
            return pages, []  # keep the pages that do have text
        raise ValueError(f"This file has no selectable text and OCR failed: {e}")
    new_pages = [(n, got.get(n, t) if got.get(n, "").strip() else t) for n, t in pages]
    used = [n for n, t in got.items() if t.strip()]
    if not any(t.strip() for _, t in new_pages):
        raise ValueError("OCR ran but found no readable text in this file.")
    return new_pages, used


def _chunks(doc_id: int, patient_id: int, filename: str, doc_type: str, pages, ocr_pages=()) -> list[Document]:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    out, n = [], 0
    for page, text in pages:
        is_ocr = page in ocr_pages
        for piece in splitter.split_text(text):
            # contextual header: the document name/page is embedded with the text, which improves retrieval and citations
            tag = " | OCR" if is_ocr else ""
            header = f"[{filename} | page {page}{tag}]" if page else f"[{filename}{tag}]"
            out.append(Document(page_content=f"{header}\n{piece}", metadata={
                "doc_id": doc_id, "patient_id": patient_id, "title": filename, "doc_type": doc_type, "page": page, "chunk": n,
                "ocr": 1 if is_ocr else 0}))
            n += 1
    return out


def ingest(filename: str, data: bytes, patient_id: int | None, doc_type: str = "Other") -> dict:
    pid = patient_id or 0
    sha = hashlib.sha256(data).hexdigest()
    with _db() as c:
        if c.execute("SELECT id FROM documents WHERE sha = ? AND patient_id = ?", (sha, pid)).fetchone():
            raise ValueError("This document is already uploaded.")
    pages, ocr_pages = _apply_ocr(filename, data, parse(filename, data))
    if not any(t.strip() for _, t in pages):
        raise ValueError("No readable text found in this file.")

    stored = None
    with _db() as c:
        cur = c.execute("INSERT INTO documents (filename, patient_id, doc_type, sha, pages, size, uploaded_at) VALUES (?,?,?,?,?,?,?)",
                        (filename, pid, doc_type, sha, len(pages), len(data), datetime.now().isoformat(timespec="seconds")))
        doc_id = cur.lastrowid
    try:
        safe_name = re.sub(r"[^\w.\-]", "_", filename)
        stored = f"{doc_id}-{safe_name}"
        (FILES_DIR / stored).write_bytes(data)
        chunks = _chunks(doc_id, pid, filename, doc_type, pages, ocr_pages)
        store(COLLECTION).add_documents(chunks, ids=[f"doc{doc_id}-{i}" for i in range(len(chunks))])
    except Exception:
        delete(doc_id)  # don't leave a half-indexed document behind
        raise
    with _db() as c:
        c.execute("UPDATE documents SET chunks = ?, stored_name = ?, ocr = ? WHERE id = ?", (len(chunks), stored, len(ocr_pages), doc_id))
    return get(doc_id)


def get(doc_id: int) -> dict | None:
    with _db() as c:
        row = c.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    return dict(row) if row else None


def list_documents(patient_id: int | None = None) -> list[dict]:
    """patient_id=None -> clinic-wide documents; otherwise that patient's documents."""
    with _db() as c:
        rows = c.execute("SELECT * FROM documents WHERE patient_id = ? ORDER BY id DESC", (patient_id or 0,)).fetchall()
    return [dict(r) for r in rows]


def file_path(doc_id: int) -> Path | None:
    d = get(doc_id)
    return FILES_DIR / d["stored_name"] if d and d["stored_name"] else None


def delete(doc_id: int) -> None:
    d = get(doc_id)
    if not d:
        return
    try:
        ids = store(COLLECTION).get(where={"doc_id": doc_id})["ids"]
        if ids:
            store(COLLECTION).delete(ids=ids)
    except Exception:
        pass
    if d["stored_name"]:
        (FILES_DIR / d["stored_name"]).unlink(missing_ok=True)
    with _db() as c:
        c.execute("DELETE FROM documents WHERE id = ?", (doc_id,))


def seed_knowledge(force: bool = False) -> int:
    """Load knowledge/*.md as clinic documents (sample protocols)."""
    n = 0
    for f in sorted(config.KNOWLEDGE_DIR.glob("*.md")):
        with _db() as c:
            row = c.execute("SELECT id FROM documents WHERE patient_id = 0 AND filename = ?", (f.name,)).fetchone()
        if row and not force:
            continue
        if row:
            delete(row["id"])
        ingest(f.name, f.read_bytes(), None, "Protocol / Guideline")
        n += 1
    return n


def ensure_seeded() -> None:
    global _seeded
    if not _seeded:
        if not list_documents(None):  # only seed a brand-new install, never resurrect documents you deleted
            seed_knowledge()
        _seeded = True


def search_scope(query: str, patient_id: int, k: int = 5) -> list[dict]:
    hits = retrieval.hybrid_search(COLLECTION, query, {"patient_id": patient_id}, k)
    return [{"scope": "clinic" if patient_id == 0 else "patient", "doc_id": d.metadata["doc_id"], "title": d.metadata["title"],
             "page": d.metadata.get("page", 0), "doc_type": d.metadata.get("doc_type", ""), "ocr": d.metadata.get("ocr", 0),
             "text": d.page_content} for d in hits]


def search_documents(query: str, patient_id: int | None = None, k: int = 5, rerank_backend: str | None = None) -> list[dict]:
    """Clinic documents always, plus the patient's own when patient_id is given. Hybrid retrieval over a pool of 3k candidates,
    interleaved across scopes, then reranked down to k."""
    ensure_seeded()
    pool = k * 3
    groups = [search_scope(query, 0, pool)]
    if patient_id:
        groups.insert(0, search_scope(query, patient_id, pool))
    merged = [x for row in zip_longest(*groups) for x in row if x]  # round-robin by rank so one scope can't crowd out the other
    return rerank.rerank(query, merged, k, rerank_backend)

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from . import agent, agentic_rag, core, docs, drafts, features, rag, safety
from . import clinic_api as api

app = FastAPI(title="Dental Clinic AI service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(httpx.HTTPError)
async def clinic_api_error(request: Request, exc: httpx.HTTPError):
    return JSONResponse(status_code=502, content={"detail": f"Clinic API error: {exc}. Is the Node backend running on port 5001?"})


@app.exception_handler(Exception)
async def any_error(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {exc}"})


class AskBody(BaseModel):
    question: str
    patient_id: int | None = None
    thread_id: str = "default"


class ExtractBody(BaseModel):
    text: str


class CheckBody(BaseModel):
    patient_id: int
    items: list[core.RxItem]


class InstructionsBody(BaseModel):
    patient_id: int
    topic: str
    language: str = "English"


class ReindexBody(BaseModel):
    patient_id: int | None = None


class RagBody(BaseModel):
    question: str
    patient_id: int | None = None


@app.get("/ai/health")
def health():
    from . import config
    return {"ok": True, "model": config.MODEL, "rerank": config.RERANK_BACKEND, "ocr": config.OCR_BACKEND, "ocr_model": config.OCR_MODEL}


@app.post("/ai/ask")
def ask(b: AskBody):
    return agent.ask(b.question, b.patient_id, b.thread_id)


@app.get("/ai/patients/{pid}/brief")
def brief(pid: int):
    return {"brief": features.patient_brief(pid)}


@app.post("/ai/consultation/extract")
def extract(b: ExtractBody):
    return features.extract_consultation(b.text)


@app.post("/ai/prescription/check")
def check(b: CheckBody):
    medical = api.get(f"/patients/{b.patient_id}/medical-history")
    return {"warnings": safety.check_prescription([i.model_dump() for i in b.items], medical)}


@app.post("/ai/instructions")
def instructions(b: InstructionsBody):
    return features.patient_instructions(b.patient_id, b.topic, b.language)


@app.post("/ai/reindex")
def reindex(b: ReindexBody):
    protocols = rag.index_protocols(force=True)
    records = rag.index_patient(b.patient_id) if b.patient_id else rag.index_all()
    return {"records_indexed": records, "protocol_chunks": protocols}


@app.get("/ai/drafts")
def list_drafts(patient_id: int | None = None, status: str = "pending"):
    return drafts.list_drafts(patient_id, status)


@app.post("/ai/drafts/{draft_id}/approve")
def approve(draft_id: int):
    try:
        return drafts.approve(draft_id)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(409, str(e))


@app.post("/ai/drafts/{draft_id}/reject")
def reject(draft_id: int):
    try:
        return drafts.reject(draft_id)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(409, str(e))


# ---------------- documents + agentic RAG ----------------
@app.post("/ai/documents/upload")
def upload_document(file: UploadFile = File(...), scope: str = Form("patient"), patient_id: int | None = Form(None), doc_type: str = Form("Other")):
    if scope == "patient" and not patient_id:
        raise HTTPException(400, "patient_id is required for patient documents")
    try:
        return docs.ingest(file.filename, file.file.read(), patient_id if scope == "patient" else None, doc_type)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/ai/documents")
def list_documents(scope: str = "clinic", patient_id: int | None = None):
    return docs.list_documents(patient_id if scope == "patient" or patient_id else None)


@app.get("/ai/documents/{doc_id}/file")
def document_file(doc_id: int):
    path = docs.file_path(doc_id)
    if not path or not path.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(path, filename=docs.get(doc_id)["filename"], content_disposition_type="inline")


@app.delete("/ai/documents/{doc_id}")
def delete_document(doc_id: int):
    docs.delete(doc_id)
    return {"ok": True}


@app.post("/ai/rag/ask")
def rag_ask(b: RagBody):
    return agentic_rag.ask(b.question, b.patient_id)

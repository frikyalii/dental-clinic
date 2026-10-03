# 🦷 Dentist Patient Management (local demo)

React + Bootstrap 5 frontend · Node/Express backend · MySQL. No login, no auth — for local/demo use only.

## Setup

1. **Database**
   ```bash
   mysql -u root -p < backend/database/schema.sql
   mysql -u root -p < backend/database/seed.sql   # optional demo patient
   ```
2. **Backend** (http://localhost:5001)
   ```bash
   cd backend
   cp .env.example .env      # set DB_PASSWORD if your MySQL root has one
   npm install
   npm start
   ```
3. **Frontend** (http://localhost:3000)
   ```bash
   cd frontend
   npm install
   npm start
   ```
   `frontend/src/setupProxy.js` proxies `/api` and `/uploads` to the Express backend (5001) and `/ai` to the AI service (8000).
4. **AI service** (optional, http://localhost:8000) - see the AI section below.

## Structure

```
backend/   server.js · routes/index.js · controllers/* · database/{db.js,schema.sql,seed.sql} · uploads/
frontend/src/
  pages/        thin route pages (Dashboard, Patients, PatientDetails, ...)
  components/   *Panel components hold the feature logic; the same panel is used on a list
                page (all patients) and inside a Patient Details tab (one patient via patientId)
  services/     api.js (axios + helpers) · print.js (prescription / invoice print)
```

## Notes
- Patient IDs (`PAT-001`, …) are generated from the auto-increment id.
- Deleting a patient deletes all their records (foreign keys `ON DELETE CASCADE`); uploaded image files of a deleted patient stay in `backend/uploads`.
- Generic patient-owned resources (dental-history, consultations, diagnoses, appointments, followups, treatments) share one CRUD factory: `backend/controllers/crud.js`.

## AI service (LangChain + LangGraph + FastMCP, open-source models on Hugging Face - free)

1. Create a free account at huggingface.co and a **fine-grained access token** (Settings > Access Tokens) with the permission **"Make calls to Inference Providers"**.
2. Run the service:
```bash
cd ai_service
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                     # paste your HF_TOKEN
uvicorn app.main:app --port 8000 --reload
```
The Node backend must be running (the AI service reads and writes only through its REST API). Nothing is downloaded or run locally: the chat model and the embedding model are both hosted by Hugging Face.

| Feature | Where | Built with |
|---|---|---|
| Pre-visit brief | Patient > Overview | LangChain chain |
| Ask about this patient (RAG + citations) | Patient > ✨ AI Assistant | LangGraph agent + Chroma, filtered by `patient_id` |
| Clinic-wide assistant | Sidebar > ✨ AI Assistant | LangGraph agent (all tools) |
| Draft appointment / follow-up / consultation / prescription | Approval queue in the AI tab | Draft tools + SQLite queue; **approve** writes via the Express API |
| Fill consultation form from rough notes | New Consultation form | LangChain structured output |
| Prescription safety check (allergies/interactions) | Prescription form + auto on drafts | Deterministic rules in `app/safety.py` (starter set only) |
| Upload documents (PDF/DOCX/TXT/MD/scans/photos) for a patient or the whole clinic | Patient > Documents; sidebar > 📚 Knowledge Base | Parse > chunk > embed > Chroma (`app/docs.py`) |
| Deep answer with citations (agentic RAG) | ✨ AI Assistant > 📚 Deep answer | LangGraph loop: route > rewrite > hybrid retrieve > grade > generate > verify (`app/agentic_rag.py`) |
| Care instructions in English/Hindi/Marathi | Patient > ✨ AI Assistant | LangChain chain + protocol RAG (`knowledge/*.md`) |
| MCP server | `python -m app.mcp_server` | FastMCP (same tools as the agent) |

### Documents & agentic RAG
- **Ingestion** (`app/docs.py`): PDF (pypdf), DOCX (python-docx), TXT/MD. Text is split into ~1000-character chunks (150 overlap) with a `[file | page]` header, embedded, and stored with metadata (`doc_id`, `patient_id`, page). Clinic documents use `patient_id = 0`; a patient's documents are only ever searched for that patient. Originals are kept in `ai_service/data/files` so citations can open the source.
- **Hybrid retrieval** (`app/retrieval.py`): vector search + BM25 keyword search fused with Reciprocal Rank Fusion, so both meaning ("toothache") and exact terms (tooth 46, drug names) match. The same hybrid search is used for the patient's chart records.
- **Agentic RAG** (`app/agentic_rag.py`, LangGraph): *route* (which sources?) > *rewrite* (1-3 focused queries) > *retrieve* > *grade* (LLM keeps only useful passages; retries with new queries if none) > *generate* (answers only from numbered passages, `[n]` citations; declines instead of guessing) > *verify* (fact-checks the answer; regenerates once if claims are unsupported). Every step has a fallback, because small free models sometimes fail structured output. The UI shows sources, a verified badge and the step trace.
- **Also available as tools:** `search_documents` (fast search) is in the chat agent; `ask_documents` (the full agentic pipeline) is exposed over MCP.
- **Limits:** OCR needs a vision model (see below); the default embedding model is English-only (for Hindi/Marathi documents try a multilingual `EMBEDDING_MODEL` that is available on HF Inference); deleting a patient in the main app does not delete their uploaded documents - delete them from the patient's Documents tab first. Document text is sent to Hugging Face for embedding and answering.

### Reranking, OCR and evaluation
- **Reranker** (`app/rerank.py`): after hybrid retrieval, the hosted chat model scores every candidate passage 0-10 against the question in a single call and the passages are re-ordered by score (ties keep the retrieval order). In agentic RAG this one call also replaces the old grade step: passages scoring below 5 are dropped. Any failure falls back to the retrieval order. `RERANK_BACKEND=none` turns it off. A hosted cross-encoder (e.g. bge-reranker) is not reliably served on Hugging Face's free tier, so the module is pluggable if you later get one.
- **OCR** (`app/ocr.py`): scanned PDFs (pages with no text layer) and PNG/JPG/WEBP images are read with a hosted open-weight vision model on Hugging Face (`OCR_BACKEND=vlm`, `OCR_MODEL=Qwen/Qwen2.5-VL-72B-Instruct`, no install). Optional local alternative: `OCR_BACKEND=tesseract` (`pip install pytesseract` and `brew install tesseract`). PDF pages are rendered with pypdfium2; at most `OCR_MAX_PAGES` (10) pages per document are read. OCR'd documents carry an **OCR** badge in the document list and in citations because OCR can misread numbers. If `OCR_MODEL` is not available on your account, pick another vision model served by HF Inference Providers.
- **Evaluation** (`eval/`): `python eval/run_eval.py --offline` (retrieval metrics, no API calls), `python eval/run_eval.py --compare-rerank` (retrieval without vs with the reranker), `python eval/run_eval.py --mode full` (runs the whole agentic pipeline and checks the answers). It uses its own data folder and the sample documents in `eval/sample_docs`, and exits non-zero if a search ever leaks another patient's document. See `eval/README.md`.

**Design rules:** one tool layer (`app/core.py`) feeds both the agent and MCP; in a patient-scoped chat the server injects `patient_id` (the model cannot pick another patient) and cross-patient tools are removed; the AI can only create drafts, never write records directly.

**Free-tier notes**
- The free tier gives limited monthly credits and rate limits. If you hit them you will see an error toast; wait, pick a smaller model (`AI_MODEL=Qwen/Qwen2.5-7B-Instruct`), or add a provider suffix such as `:cheapest`.
- The model must support **tool calling** (used by the assistant). Available models and providers change; list them at https://router.huggingface.co/v1/models and https://huggingface.co/docs/inference-providers.
- Patient records are sent to Hugging Face and its inference providers when you use AI features. That is fine for demo data; for real patients, review their terms or self-host an open model instead.
- Only new or changed records are embedded, to save quota. Force a full re-sync with `POST /ai/reindex`.

**MCP with any MCP client** (e.g. the open-source MCP Inspector: `npx @modelcontextprotocol/inspector python -m app.mcp_server`) - stdio config example:
```json
{ "mcpServers": { "dental-clinic": {
    "command": "/full/path/to/ai_service/.venv/bin/python",
    "args": ["-m", "app.mcp_server"],
    "cwd": "/full/path/to/ai_service" } } }
```
Or run `python -m app.mcp_server --http` to serve MCP at http://127.0.0.1:8001/mcp.

**Before real patient data:** add authentication and per-user access control (the demo has none), and extend `safety.py` / `knowledge/` with your clinic's own rules and protocols.

### Free & open-source stack
React, Bootstrap, Node.js/Express, MySQL (Community), Multer · Python, FastAPI · LangChain, LangGraph, FastMCP · open-weight models (gpt-oss / Llama / Qwen) and open embedding models hosted on Hugging Face · Chroma vector DB.

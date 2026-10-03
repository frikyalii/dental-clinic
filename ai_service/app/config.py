import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent
CLINIC_API_URL = os.getenv("CLINIC_API_URL", "http://localhost:5001/api")
HF_TOKEN = os.getenv("HF_TOKEN", "")
HF_BASE_URL = os.getenv("HF_BASE_URL", "https://router.huggingface.co/v1")  # OpenAI-compatible HF Inference Providers
MODEL = os.getenv("AI_MODEL", "openai/gpt-oss-120b")  # open-weight model that supports tool calling
EMBED_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
DATA_DIR = Path(os.getenv("AI_DATA_DIR", ROOT / "data"))
KNOWLEDGE_DIR = ROOT / "knowledge"
RERANK_BACKEND = os.getenv("RERANK_BACKEND", "llm").lower()  # llm = score passages with the chat model | none
OCR_BACKEND = os.getenv("OCR_BACKEND", "vlm").lower()          # vlm = hosted HF vision model | tesseract = local | none
OCR_MODEL = os.getenv("OCR_MODEL", "Qwen/Qwen2.5-VL-72B-Instruct")  # must be a vision model served by HF Inference Providers
OCR_MAX_PAGES = int(os.getenv("OCR_MAX_PAGES", "10"))          # OCR at most this many pages per document (saves free-tier quota)
REINDEX_AFTER_SECONDS = 300  # sync a patient's records into the index if it is older than this (only changed records are embedded)

DATA_DIR.mkdir(parents=True, exist_ok=True)

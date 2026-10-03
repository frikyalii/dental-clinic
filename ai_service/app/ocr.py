"""OCR for scanned PDFs and images.
  vlm        hosted open-weight vision model on Hugging Face Inference Providers (default, free tier, nothing to install)
  tesseract  local Tesseract (optional: pip install pytesseract + install the tesseract program)
PDF pages are rendered to images with pypdfium2. OCR text can contain mistakes (handwriting, poor scans), so documents that used
OCR are flagged in the UI and in citations."""
import base64
import io
import time
import httpx
from . import config

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}
PROMPT = ("Transcribe ALL text in this image exactly as written, in reading order. Keep tables as rows with ' | ' between cells. "
          "Do not summarise, translate or add commentary. If there is no text, reply with nothing.")


def enabled() -> bool:
    return config.OCR_BACKEND in ("vlm", "tesseract")


def _data_url(img) -> str:
    img = img.convert("RGB")
    img.thumbnail((1600, 1600))  # keep uploads small and quick
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def _vlm(img) -> str:
    from .llm import require_token
    require_token()
    payload = {"model": config.OCR_MODEL, "temperature": 0, "max_tokens": 3000, "messages": [{"role": "user", "content": [
        {"type": "text", "text": PROMPT}, {"type": "image_url", "image_url": {"url": _data_url(img)}}]}]}
    last = ""
    for attempt in range(4):
        r = httpx.post(f"{config.HF_BASE_URL}/chat/completions", headers={"Authorization": f"Bearer {config.HF_TOKEN}"}, json=payload, timeout=180)
        if r.status_code in (429, 503):
            last = f"{r.status_code} {r.text[:120]}"
            time.sleep(2 * (attempt + 1))
            continue
        if r.status_code >= 400:
            raise RuntimeError(f"OCR model '{config.OCR_MODEL}' returned {r.status_code}: {r.text[:200]} "
                               "(check OCR_MODEL: it must be a vision model currently served by HF Inference Providers)")
        content = r.json()["choices"][0]["message"]["content"]
        if isinstance(content, list):
            content = "".join(b.get("text", "") for b in content if isinstance(b, dict))
        return (content or "").strip()
    raise RuntimeError(f"OCR service is busy or rate limited ({last}). Try again in a minute.")


def _tesseract(img) -> str:
    import pytesseract  # optional dependency
    return pytesseract.image_to_string(img).strip()


def ocr_image(img) -> str:
    return _tesseract(img) if config.OCR_BACKEND == "tesseract" else _vlm(img)


def ocr_image_bytes(data: bytes) -> str:
    from PIL import Image
    return ocr_image(Image.open(io.BytesIO(data)))


def ocr_pdf_pages(data: bytes, page_numbers: list[int]) -> dict[int, str]:
    """OCR the given 1-based pages (at most OCR_MAX_PAGES of them)."""
    import pypdfium2 as pdfium
    pdf = pdfium.PdfDocument(data)
    out = {}
    for n in page_numbers[:config.OCR_MAX_PAGES]:
        out[n] = ocr_image(pdf[n - 1].render(scale=2).to_pil())
    return out

from functools import lru_cache
from . import config


def require_token():
    if not config.HF_TOKEN:
        raise RuntimeError("HF_TOKEN is not set. Create a free token at https://huggingface.co/settings/tokens "
                           "(permission: 'Make calls to Inference Providers') and put it in ai_service/.env")


@lru_cache
def get_llm():
    """Open-weight model served by Hugging Face Inference Providers (free tier), via its OpenAI-compatible API."""
    from langchain_openai import ChatOpenAI
    require_token()
    return ChatOpenAI(model=config.MODEL, base_url=config.HF_BASE_URL, api_key=config.HF_TOKEN,
                      temperature=0.2, max_tokens=1500, timeout=120, max_retries=2)

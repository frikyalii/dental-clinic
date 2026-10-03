"""Thin client for the existing Node/Express clinic API. The AI service never touches MySQL directly."""
import httpx
from . import config


def get(path: str, **params):
    r = httpx.get(config.CLINIC_API_URL + path, params=params or None, timeout=20)
    r.raise_for_status()
    return r.json()


def post(path: str, body: dict):
    r = httpx.post(config.CLINIC_API_URL + path, json=body, timeout=20)
    r.raise_for_status()
    return r.json()

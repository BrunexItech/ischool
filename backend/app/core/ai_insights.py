"""Turns a role's structured weekly numbers into a short, professionally
written paragraph for that specific audience. Degrades to plain templated
text whenever no API key is configured or the call fails for any reason —
an AI outage must never stop the weekly report run itself."""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger("ischool.ai")

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"


def generate_narrative(system_prompt: str, data_summary: str, fallback: str) -> str:
    if not settings.ai_enabled:
        return fallback

    try:
        response = httpx.post(
            OPENAI_API_URL,
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "content-type": "application/json",
            },
            json={
                "model": settings.openai_model,
                "max_tokens": 400,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": data_summary},
                ],
            },
            timeout=20.0,
        )
        response.raise_for_status()
        choices = response.json().get("choices", [])
        text = (choices[0]["message"]["content"] if choices else "").strip()
        return text or fallback
    except Exception:
        logger.exception("AI narrative generation failed — using the plain-text fallback")
        return fallback

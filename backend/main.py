import logging
import os
import time
from typing import Optional

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

SGLANG_BASE_URL = os.getenv("SGLANG_BASE_URL", "http://127.0.0.1:30000")
MODEL_ID = os.getenv("MODEL_ID", "Qwen/Qwen2.5-Coder-7B-Instruct")
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "*").split(",")
    if origin.strip()
]

app = FastAPI(title="Canvas Coding Assistant Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SuggestRequest(BaseModel):
    platform: Optional[str] = "unknown"
    language: Optional[str] = "unknown"
    code: str
    url: Optional[str] = ""
    title: Optional[str] = ""


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    try:
        body = await request.body()
        raw_body = body.decode("utf-8", errors="replace")
    except Exception:
        raw_body = "<could not read body>"

    return JSONResponse(
        status_code=422,
        content={
            "error": "Request validation failed",
            "details": exc.errors(),
            "body": raw_body,
        },
    )


def build_prompt(req: SuggestRequest) -> str:
    trimmed_code = req.code[:6000]

    return f"""
You are a concise coding assistant.

Platform: {req.platform}
Language: {req.language}
URL: {req.url}
Title: {req.title}

Task:
Give exactly ONE short, actionable suggestion about this code.

Priority:
1. syntax issues
2. obvious bugs
3. clarity or style improvements

Rules:
- Return only one suggestion.
- Be concise.
- Do not rewrite the entire solution.
- Do not use bullet points.
- If the code looks okay, return one small improvement.

Code:
{trimmed_code}
""".strip()


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_ID}


@app.post("/suggest")
def suggest(req: SuggestRequest):
    if not req.code or not req.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty.")

    prompt = build_prompt(req)
    prompt_chars = len(prompt)

    payload = {
        "model": MODEL_ID,
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful coding assistant. Return one concise actionable suggestion.",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }

    started = time.perf_counter()
    try:
        response = requests.post(
            f"{SGLANG_BASE_URL}/v1/chat/completions",
            json=payload,
            timeout=120,
        )
        response.raise_for_status()
        data = response.json()
        suggestion = data["choices"][0]["message"]["content"].strip()
        latency_ms = round((time.perf_counter() - started) * 1000)
        logger.info(
            "suggest ok platform=%s language=%s prompt_chars=%d latency_ms=%d",
            req.platform,
            req.language,
            prompt_chars,
            latency_ms,
        )
        return {"suggestion": suggestion, "latency_ms": latency_ms}
    except requests.Timeout as exc:
        logger.warning("suggest timeout platform=%s prompt_chars=%d", req.platform, prompt_chars)
        raise HTTPException(status_code=504, detail="Model inference timed out.") from exc
    except requests.RequestException as exc:
        logger.warning("suggest upstream_error platform=%s error=%s", req.platform, exc)
        raise HTTPException(status_code=502, detail="Upstream model unavailable.") from exc
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        logger.exception("suggest bad_response platform=%s", req.platform)
        raise HTTPException(status_code=500, detail="Unexpected model response format.") from exc

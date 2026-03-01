from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests

app = FastAPI(title="Canvas Coding Assistant Backend")

# Allow the extension (and local dev pages) to call this backend.
# We'll tighten this later.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Health check ----
@app.get("/health")
def health():
    return {"status": "ok"}


# ---- SGLang config ----
SGLANG_BASE_URL = "http://127.0.0.1:30000"
MODEL_ID = "/home/jyo/.cache/huggingface/hub/models--Qwen--Qwen2.5-Coder-7B-Instruct/snapshots/c03e6d358207e414f1eca0bb1891e29f1db0e242"


class SuggestRequest(BaseModel):
    prompt: str


@app.post("/suggest")
def suggest(req: SuggestRequest):
    payload = {
        "model": MODEL_ID,
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful coding assistant. Give concise, actionable suggestions.",
            },
            {"role": "user", "content": req.prompt},
        ],
        "temperature": 0.2,
    }

    r = requests.post(
        f"{SGLANG_BASE_URL}/v1/chat/completions",
        json=payload,
        timeout=120,
    )
    r.raise_for_status()
    data = r.json()

    text = data["choices"][0]["message"]["content"]
    return {"suggestion": text}
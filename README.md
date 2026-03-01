# Canvas Coding Assistant (Qwen on GPU + Chrome Extension)

Goal: When a student is coding in Canvas (or a supported web IDE), a Chrome extension can send the current context (selected code / prompt / page metadata) to a GPU-hosted Qwen model (served via sglang + FastAPI) and show helpful suggestions in the browser.

## Repo Structure
- `extension/` — Chrome extension (UI + content scripts)
- `backend/` — FastAPI server that forwards requests to sglang
- `docs/` — architecture notes, setup, and experiments

## High-Level Architecture
Chrome Extension → FastAPI (backend) → sglang API → Qwen model (GPU server) → response back to extension

## Next Steps
1. Add extension skeleton (manifest + basic popup)
2. Add backend skeleton (FastAPI + health endpoint)
3. Define the request/response JSON contract between extension and backend
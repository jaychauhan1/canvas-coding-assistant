# Canvas Coding Assistant  
### Qwen on GPU · FastAPI Backend · Chrome Extension

![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green.svg)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-yellow.svg)
![SGLang](https://img.shields.io/badge/LLM-SGLang-orange.svg)
![Model](https://img.shields.io/badge/Model-Qwen2.5--Coder--7B-red.svg)
![GPU](https://img.shields.io/badge/GPU-RTX%204090%20Ready-9cf.svg)
![Status](https://img.shields.io/badge/Status-Working-success.svg)

An AI-powered coding assistant that runs **Qwen2.5-Coder-7B-Instruct** on a GPU server and integrates directly into Canvas through a Chrome extension.

The extension sends prompts to a FastAPI backend, which forwards them to a GPU-hosted Qwen model via SGLang, then returns suggestions back to the browser.

---

# 🧱 System Architecture

## High-Level Architecture

```mermaid
flowchart LR
    A[Chrome Extension] --> B[FastAPI Backend]
    B --> C[SGLang Server]
    C --> D[Qwen2.5-Coder-7B GPU]
    D --> C
    C --> B
    B --> A
```

---

## Detailed Component Architecture

```mermaid
flowchart TB

    subgraph Browser
        CE[Chrome Extension]
        Popup[Popup UI]
        Content[Content Script]
    end

    subgraph Backend_Server
        API[FastAPI App]
        Router[Suggest Endpoint]
    end

    subgraph GPU_Server
        SGL[SGLang API]
        Model[Qwen2.5-Coder-7B-Instruct]
    end

    Popup --> CE
    Content --> CE
    CE -->|POST request| API
    API --> Router
    Router -->|HTTP request| SGL
    SGL --> Model
    Model --> SGL
    SGL --> API
    API --> CE
```

---

# 🔄 Request Lifecycle

```mermaid
sequenceDiagram
    participant User
    participant Extension
    participant FastAPI
    participant SGLang
    participant GPU

    User->>Extension: Click Ask
    Extension->>FastAPI: POST request
    FastAPI->>SGLang: Chat Completion Request
    SGLang->>GPU: Run Inference
    GPU-->>SGLang: Generated Text
    SGLang-->>FastAPI: JSON Response
    FastAPI-->>Extension: Suggestion
    Extension-->>User: Display Output
```

---

# 📂 Repository Structure

```
canvas-coding-assistant/
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│
├── extension/
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   ├── popup.css
│   └── content.js
│
└── README.md
```

---

# ⚙️ Tech Stack

| Layer | Technology |
|-------|------------|
| Model | Qwen2.5-Coder-7B-Instruct |
| Inference Engine | SGLang |
| Backend | FastAPI |
| Frontend | Chrome Extension (Manifest v3) |
| GPU | NVIDIA RTX 4090 |
| Transport | REST (OpenAI-compatible API) |

---

# 🚀 Running the System

## 1️⃣ Start SGLang

```bash
python -m sglang.launch_server \
  --model-path "<path-to-model>" \
  --host 127.0.0.1 \
  --port 30000
```

## 2️⃣ Start FastAPI Backend

```bash
uvicorn main:app --host 127.0.0.1 --port 8000
```

Test:

```bash
curl http://127.0.0.1:8000/health
```

---

# 🔒 Security & Confidentiality

For security reasons:

- No internal IP addresses are exposed
- No usernames or SSH credentials are included
- No absolute filesystem paths are documented
- Backend is designed to run behind localhost or a secure tunnel
- CORS policies should be restricted in production
- HTTPS and authentication should be added before deployment

---

# 🎯 Vision

This project aims to evolve into:

- A context-aware AI coding tutor  
- A Canvas-integrated grading assistant  
- A memory-enabled LLM agent system  
- A scalable GPU-backed AI infrastructure  

(() => {
  const API_URL = "http://127.0.0.1:8000/suggest";

  // ---- UI: Toast ----
  function ensureStyles() {
    if (document.getElementById("canvasassist-style")) return;
    const style = document.createElement("style");
    style.id = "canvasassist-style";
    style.textContent = `
      .canvasassist-toast {
        position: fixed;
        right: 16px;
        bottom: 16px;
        width: 360px;
        max-width: calc(100vw - 32px);
        background: rgba(20, 20, 20, 0.92);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 14px;
        box-shadow: 0 18px 50px rgba(0,0,0,0.35);
        padding: 12px 12px 10px 12px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        z-index: 2147483647;
        backdrop-filter: blur(8px);
      }
      .canvasassist-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 8px;
      }
      .canvasassist-title {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.2px;
        opacity: 0.95;
      }
      .canvasassist-pill {
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 999px;
        background: rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.14);
        opacity: 0.95;
        white-space: nowrap;
      }
      .canvasassist-body {
        font-size: 13px;
        line-height: 1.35;
        opacity: 0.95;
        margin: 0;
        white-space: pre-wrap;
      }
      .canvasassist-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 10px;
      }
      .canvasassist-btn {
        font-size: 12px;
        padding: 7px 10px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(255,255,255,0.10);
        color: #fff;
        cursor: pointer;
      }
      .canvasassist-btn:hover {
        background: rgba(255,255,255,0.16);
      }
      .canvasassist-btn-primary {
        background: rgba(66, 133, 244, 0.90);
        border-color: rgba(66, 133, 244, 0.95);
      }
      .canvasassist-btn-primary:hover {
        background: rgba(66, 133, 244, 1);
      }
      .canvasassist-close {
        cursor: pointer;
        border: none;
        background: transparent;
        color: rgba(255,255,255,0.75);
        font-size: 16px;
        line-height: 16px;
        padding: 2px 6px;
        border-radius: 8px;
      }
      .canvasassist-close:hover {
        background: rgba(255,255,255,0.10);
        color: rgba(255,255,255,0.95);
      }
      .canvasassist-fade-in {
        animation: canvasassistFadeIn 160ms ease-out;
      }
      @keyframes canvasassistFadeIn {
        from { transform: translateY(8px); opacity: 0; }
        to { transform: translateY(0px); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  function showToast({ title, tag, message, onCopy }) {
    ensureStyles();

    // Remove any existing toast (keep it 1 at a time)
    const old = document.getElementById("canvasassist-toast");
    if (old) old.remove();

    const toast = document.createElement("div");
    toast.id = "canvasassist-toast";
    toast.className = "canvasassist-toast canvasassist-fade-in";

    const header = document.createElement("div");
    header.className = "canvasassist-row";

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.alignItems = "center";
    left.style.gap = "8px";

    const titleEl = document.createElement("div");
    titleEl.className = "canvasassist-title";
    titleEl.textContent = title || "CanvasAssist";

    const pill = document.createElement("div");
    pill.className = "canvasassist-pill";
    pill.textContent = tag || "Suggestion";

    left.appendChild(titleEl);
    left.appendChild(pill);

    const close = document.createElement("button");
    close.className = "canvasassist-close";
    close.textContent = "×";
    close.title = "Close";
    close.onclick = () => toast.remove();

    header.appendChild(left);
    header.appendChild(close);

    const body = document.createElement("p");
    body.className = "canvasassist-body";
    body.textContent = message || "";

    const actions = document.createElement("div");
    actions.className = "canvasassist-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "canvasassist-btn canvasassist-btn-primary";
    copyBtn.textContent = "Copy";
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(message || "");
        if (onCopy) onCopy();
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
      } catch (e) {
        copyBtn.textContent = "Copy failed";
        setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
      }
    };

    const dismissBtn = document.createElement("button");
    dismissBtn.className = "canvasassist-btn";
    dismissBtn.textContent = "Dismiss";
    dismissBtn.onclick = () => toast.remove();

    actions.appendChild(dismissBtn);
    actions.appendChild(copyBtn);

    toast.appendChild(header);
    toast.appendChild(body);
    toast.appendChild(actions);

    document.documentElement.appendChild(toast);

    // Auto-hide after 8 seconds (unless user interacts)
    let timeout = setTimeout(() => toast.remove(), 8000);
    toast.addEventListener("mouseenter", () => clearTimeout(timeout));
    toast.addEventListener("mouseleave", () => {
      timeout = setTimeout(() => toast.remove(), 4000);
    });
  }

  // ---- Logic: Call backend ----
  async function getSuggestion() {
    const payload = {
      prompt:
        "Student is on Canvas. Give one concise, actionable tip for starting a coding assignment.",
      context: { url: location.href, title: document.title }
    };

    console.log("[CanvasAssist] content script loaded on:", location.href);
    console.log("[CanvasAssist] about to fetch", API_URL, payload);

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    console.log("[CanvasAssist] status:", res.status);

    const data = await res.json();
    console.log("[CanvasAssist] /suggest response JSON:", JSON.stringify(data, null, 2));

    const msg =
      typeof data === "string"
        ? data
        : data.suggestion || data.response || JSON.stringify(data);

    showToast({
      title: "CanvasAssist",
      tag: "Tip",
      message: msg
    });
  }

  // Run once per page load
  getSuggestion().catch((err) => {
    console.error("[CanvasAssist] /suggest failed:", err);
    showToast({
      title: "CanvasAssist",
      tag: "Error",
      message: err?.message || String(err)
    });
  });
})();
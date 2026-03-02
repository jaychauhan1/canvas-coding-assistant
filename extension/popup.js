// extension/popup.js

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
}

function setOutput(msg) {
  const out = document.getElementById("output");
  if (out) out.textContent = msg;
}

window.addEventListener("error", (e) => {
  setStatus("Popup error ❌");
  setOutput(String(e.message || e.error || e));
});
window.addEventListener("unhandledrejection", (e) => {
  setStatus("Popup promise error ❌");
  setOutput(String(e.reason?.message || e.reason || e));
});

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found");
  return tab;
}

async function getPageContext(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
      const textOf = (sel) => clean(document.querySelector(sel)?.innerText);

      // Breadcrumbs: course > section > item
      const breadcrumbs = Array.from(
        document.querySelectorAll(
          "nav[aria-label='Breadcrumb navigation'] a, .ic-app-crumbs a"
        )
      )
        .map((a) => clean(a.innerText))
        .filter(Boolean)
        .slice(0, 10);

      // Detect assignment page patterns
      const isAssignment = /\/assignments\/\d+/.test(location.pathname);

      // Assignment title + due line
      const assignmentTitle =
        textOf("h1") || textOf(".assignment-title") || textOf(".page-title");

      // Often appears like "Due: Tue Mar 3, 2026 11:59pm"
      const dueText =
        Array.from(document.querySelectorAll("div, span"))
          .map((el) => clean(el.innerText))
          .find((t) => /^Due:\s*/i.test(t)) || "";

      // Pull the “Choose a submission type” section text if present
      const submissionSection = clean(
        document.querySelector("form")?.innerText || ""
      );

      // Try to capture the assignment details/instructions area but avoid sidebar junk
      const detailsText = clean(
        document.querySelector(
          ".description, .user_content, .show-content, .assignment_details"
        )?.innerText || ""
      );

      // Collect links inside the main content area (NOT sidebar)
      const main =
        document.querySelector("#content") ||
        document.querySelector("#main") ||
        document.querySelector("main") ||
        document.body;

      const mainLinks = Array.from(main.querySelectorAll("a"))
        .map((a) => ({ text: clean(a.innerText), href: a.href }))
        .filter((x) => x.text && x.text.length >= 4 && x.text.length <= 90)
        .slice(0, 20);

      return {
        url: location.href,
        path: location.pathname,
        title: document.title,
        breadcrumbs,
        isAssignment,
        assignmentTitle,
        dueText,
        detailsText: detailsText.slice(0, 1200),
        submissionSection: submissionSection.slice(0, 1200),
        mainLinks
      };
    }
  });

  return results?.[0]?.result;
}

async function callSuggest(payload) {
  const res = await fetch("http://127.0.0.1:8000/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = { error: "Backend did not return JSON." };
  }

  return { status: res.status, data };
}

// Used by Ping button (keep strict 3-step format)
function buildSystemPrompt(ctx) {
  return (
    "You are a Canvas assistant. You must NOT invent anything.\n" +
    "LOCKED FACTS (must match exactly if mentioned):\n" +
    `- assignmentTitle: "${ctx.assignmentTitle || ""}"\n` +
    `- dueText: "${ctx.dueText || ""}"\n` +
    `- pagePath: "${ctx.path || ""}"\n` +
    "\n" +
    "Use ONLY these sources: assignmentTitle, dueText, detailsText, submissionSection, mainLinks (text+href), breadcrumbs.\n" +
    "Task: give exactly 3 next steps that are specific to THIS page.\n" +
    "Rules:\n" +
    "- If assignmentTitle is present, you must reference it exactly.\n" +
    "- If dueText is present, you must reference it exactly.\n" +
    "- If you cannot find something in the sources, say you cannot find it.\n" +
    "- DO NOT mention quizzes/modules/other assignments unless they appear in the sources.\n" +
    "- Output format EXACTLY:\n" +
    "1) <action> — Evidence: \"<exact quote>\"\n" +
    "2) <action> — Evidence: \"<exact quote>\"\n" +
    "3) <action> — Evidence: \"<exact quote>\""
  );
}

function buildAskPrompt(ctx, userText) {
  const q = (userText || "").trim();
  const isDueQuestion = /\bdue\b|\bdue date\b|\bdeadline\b/i.test(q);

  // Base rules: always use only context, never invent
  let prompt =
    "You are a Canvas assistant. You must NOT invent anything.\n" +
    "Answer the user's question using ONLY the provided context.\n" +
    "If the answer is not in the context, say: \"I can't find that on this page.\" and briefly state which field(s) were empty or missing.\n\n" +
    "CONTEXT (verbatim snippets):\n" +
    `assignmentTitle: "${ctx.assignmentTitle || ""}"\n` +
    `pagePath: "${ctx.path || ""}"\n` +
    `detailsText: "${(ctx.detailsText || "").slice(0, 800)}"\n` +
    `submissionSection: "${(ctx.submissionSection || "").slice(0, 800)}"\n\n`;

  // Only include dueText + due rules when user actually asks about it
  if (isDueQuestion) {
    prompt +=
      `dueText: "${ctx.dueText || ""}"\n\n` +
      "DUE DATE RULES:\n" +
      "- If dueText is present, quote it exactly.\n" +
      "- If dueText is empty, say: \"I can't find the due date on this page.\".\n\n";
  }

  prompt += `USER QUESTION:\n${q}\n`;
  return prompt;
}

document.addEventListener("DOMContentLoaded", () => {
  setStatus("Popup loaded ✅");
  setOutput("Click “Ping backend”.");

  const pingBtn = document.getElementById("pingBtn");
  const askBtn = document.getElementById("askBtn");
  const promptInput = document.getElementById("promptInput");

  if (!pingBtn) {
    setStatus("Popup error ❌");
    setOutput("Button #pingBtn not found in popup.html");
    return;
  }

  // -------------------------
  // Ping: strict 3 next steps
  // -------------------------
  pingBtn.addEventListener("click", async () => {
    try {
      setStatus("Getting active tab...");
      setOutput("");

      const tab = await getActiveTab();

      setStatus("Reading page context...");
      const ctx = await getPageContext(tab.id);

      if (!ctx) {
        setStatus("Error ❌");
        setOutput("Could not read page context (executeScript returned nothing).");
        return;
      }

      setStatus("Calling backend...");

      const payload = {
        prompt: buildSystemPrompt(ctx),
        context: ctx
      };

      const { status, data } = await callSuggest(payload);

      const msg =
        typeof data === "string"
          ? data
          : (data.suggestion || data.response || JSON.stringify(data, null, 2));

      setStatus(`Done ✅ (HTTP ${status})`);
      setOutput(msg);
    } catch (e) {
      setStatus("Error ❌");
      setOutput(e?.message || String(e));
    }
  });

  // -------------------------
  // Ask: answer user question (no due-date hijacking)
  // -------------------------
  if (askBtn && promptInput) {
    askBtn.addEventListener("click", async () => {
      const userText = (promptInput.value || "").trim();

      if (!userText) {
        setStatus("Type something to ask.");
        return;
      }

      try {
        setStatus("Getting active tab...");
        setOutput("");

        const tab = await getActiveTab();

        setStatus("Reading page context...");
        const ctx = await getPageContext(tab.id);

        if (!ctx) {
          setStatus("Error ❌");
          setOutput("Could not read page context (executeScript returned nothing).");
          return;
        }

        setStatus("Calling backend...");

        const payload = {
          prompt: buildAskPrompt(ctx, userText),
          context: ctx
        };

        const { status, data } = await callSuggest(payload);

        const msg =
          typeof data === "string"
            ? data
            : (data.suggestion || data.response || JSON.stringify(data, null, 2));

        setStatus(`Done ✅ (HTTP ${status})`);
        setOutput(msg);
      } catch (e) {
        setStatus("Error ❌");
        setOutput(e?.message || String(e));
      }
    });
  }
});
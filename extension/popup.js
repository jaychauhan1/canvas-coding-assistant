const output = document.getElementById("output");
const pingBtn = document.getElementById("pingBtn");

// We'll wire this to FastAPI in the next step.
// For now, just prove JS runs.
pingBtn.addEventListener("click", async () => {
  output.textContent = "Popup JS is working ✅ (backend not connected yet)";
});
const output = document.getElementById("output");
const pingBtn = document.getElementById("pingBtn");

pingBtn.addEventListener("click", async () => {
  output.textContent = "Asking model...";

  try {
    const res = await fetch("http://127.0.0.1:8000/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Write a Python function that checks if a string is a palindrome."
      }),
    });

    const data = await res.json();
    output.textContent = data.suggestion ?? JSON.stringify(data, null, 2);
  } catch (err) {
    output.textContent = `Error: ${err}`;
  }
});
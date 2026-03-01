const output = document.getElementById("output");
const pingBtn = document.getElementById("pingBtn");

pingBtn.addEventListener("click", async () => {
  output.textContent = "Pinging backend...";

  try {
    const res = await fetch("http://127.0.0.1:8000/health");
    const data = await res.json();
    output.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    output.textContent = `Error: ${err}`;
  }
});